import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
import { createTRPCRouter, protectedProcedure } from '../trpc';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16',
});

const createPaymentIntentSchema = z.object({
  amount: z.number().min(1),
  currency: z.string().default('USD'),
  sessionId: z.string().optional(),
  bookingId: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const confirmPaymentSchema = z.object({
  paymentIntentId: z.string(),
  paymentMethodId: z.string(),
});

const refundPaymentSchema = z.object({
  paymentId: z.string(),
  amount: z.number().optional(), // Partial refund if provided
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).default('requested_by_customer'),
});

const createSubscriptionSchema = z.object({
  priceId: z.string(),
  paymentMethodId: z.string(),
});

export const paymentRouter = createTRPCRouter({
  // Create payment intent for charging session
  createPaymentIntent: protectedProcedure
    .input(createPaymentIntentSchema)
    .mutation(async ({ input, ctx }) => {
      const { amount, currency, sessionId, bookingId, metadata } = input;

      try {
        // Create payment intent with Stripe
        const paymentIntent = await stripe.paymentIntents.create({
          amount: Math.round(amount * 100), // Convert to cents
          currency: currency.toLowerCase(),
          customer: ctx.user!.stripeCustomerId, // Assume user has Stripe customer ID
          metadata: {
            userId: ctx.user!.id,
            sessionId: sessionId || '',
            bookingId: bookingId || '',
            ...metadata,
          },
          automatic_payment_methods: {
            enabled: true,
          },
        });

        // Create payment record in database
        const payment = await ctx.prisma.payment.create({
          data: {
            amount,
            currency,
            status: 'PENDING',
            method: 'CREDIT_CARD',
            stripePaymentId: paymentIntent.id,
            userId: ctx.user!.id,
            sessionId,
            bookingId,
            metadata: metadata || {},
          },
        });

        return {
          paymentId: payment.id,
          clientSecret: paymentIntent.client_secret,
          amount,
          currency,
        };
      } catch (error) {
        console.error('Payment intent creation failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create payment intent',
        });
      }
    }),

  // Confirm payment (called after successful Stripe confirmation)
  confirmPayment: protectedProcedure
    .input(confirmPaymentSchema)
    .mutation(async ({ input, ctx }) => {
      const { paymentIntentId, paymentMethodId } = input;

      try {
        // Retrieve payment intent from Stripe
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

        if (paymentIntent.status !== 'succeeded') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Payment not successful',
          });
        }

        // Update payment record
        const payment = await ctx.prisma.payment.update({
          where: {
            stripePaymentId: paymentIntentId,
            userId: ctx.user!.id,
          },
          data: {
            status: 'COMPLETED',
            metadata: {
              paymentMethodId,
              confirmedAt: new Date().toISOString(),
            },
          },
        });

        // Update charging session if applicable
        if (payment.sessionId) {
          await ctx.prisma.chargingSession.update({
            where: { id: payment.sessionId },
            data: { cost: payment.amount },
          });
        }

        // Update booking if applicable
        if (payment.bookingId) {
          await ctx.prisma.booking.update({
            where: { id: payment.bookingId },
            data: { totalCost: payment.amount },
          });
        }

        return {
          paymentId: payment.id,
          status: payment.status,
          amount: payment.amount,
        };
      } catch (error) {
        console.error('Payment confirmation failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to confirm payment',
        });
      }
    }),

  // Get payment history for user
  getPaymentHistory: protectedProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(50).default(20),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit } = input;
      const offset = (page - 1) * limit;

      const [payments, total] = await Promise.all([
        ctx.prisma.payment.findMany({
          where: { userId: ctx.user!.id },
          include: {
            session: {
              include: {
                port: {
                  include: { station: true },
                },
              },
            },
            booking: {
              include: {
                station: true,
                port: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.prisma.payment.count({
          where: { userId: ctx.user!.id },
        }),
      ]);

      return {
        payments,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }),

  // Refund payment
  refundPayment: protectedProcedure
    .input(refundPaymentSchema)
    .mutation(async ({ input, ctx }) => {
      const { paymentId, amount, reason } = input;

      try {
        // Get payment record
        const payment = await ctx.prisma.payment.findFirst({
          where: {
            id: paymentId,
            userId: ctx.user!.id,
            status: 'COMPLETED',
          },
        });

        if (!payment || !payment.stripePaymentId) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Payment not found or cannot be refunded',
          });
        }

        // Create refund with Stripe
        const refund = await stripe.refunds.create({
          payment_intent: payment.stripePaymentId,
          amount: amount ? Math.round(amount * 100) : undefined,
          reason,
          metadata: {
            originalPaymentId: paymentId,
            userId: ctx.user!.id,
          },
        });

        // Update payment status
        await ctx.prisma.payment.update({
          where: { id: paymentId },
          data: {
            status: 'REFUNDED',
            metadata: {
              ...payment.metadata,
              refundId: refund.id,
              refundedAt: new Date().toISOString(),
              refundAmount: refund.amount / 100,
            },
          },
        });

        return {
          refundId: refund.id,
          amount: refund.amount / 100,
          status: refund.status,
        };
      } catch (error) {
        console.error('Refund failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to process refund',
        });
      }
    }),

  // Create subscription for tenant
  createSubscription: protectedProcedure
    .input(createSubscriptionSchema)
    .mutation(async ({ input, ctx }) => {
      const { priceId, paymentMethodId } = input;

      try {
        // Create subscription with Stripe
        const subscription = await stripe.subscriptions.create({
          customer: ctx.user!.stripeCustomerId,
          items: [{ price: priceId }],
          payment_behavior: 'default_incomplete',
          payment_settings: {
            payment_method_types: ['card'],
          },
          default_payment_method: paymentMethodId,
          expand: ['latest_invoice.payment_intent'],
        });

        // Create subscription record
        const subscriptionRecord = await ctx.prisma.subscription.create({
          data: {
            plan: priceId,
            status: 'ACTIVE',
            currentPeriodStart: new Date(subscription.current_period_start * 1000),
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            stripeSubscriptionId: subscription.id,
            tenantId: ctx.user!.tenantId,
          },
        });

        return {
          subscriptionId: subscriptionRecord.id,
          stripeSubscriptionId: subscription.id,
          status: subscription.status,
          clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
        };
      } catch (error) {
        console.error('Subscription creation failed:', error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create subscription',
        });
      }
    }),

  // Get revenue analytics for tenant
  getRevenueAnalytics: protectedProcedure
    .input(z.object({
      startDate: z.date(),
      endDate: z.date(),
      groupBy: z.enum(['day', 'week', 'month']).default('day'),
    }))
    .query(async ({ input, ctx }) => {
      const { startDate, endDate, groupBy } = input;

      // Get payments for tenant's stations
      const payments = await ctx.prisma.payment.findMany({
        where: {
          status: 'COMPLETED',
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
          session: {
            port: {
              station: {
                tenantId: ctx.user!.tenantId,
              },
            },
          },
        },
        include: {
          session: {
            include: {
              port: {
                include: { station: true },
              },
            },
          },
        },
      });

      // Group payments by time period
      const groupedData = payments.reduce((acc, payment) => {
        const date = payment.createdAt;
        let key: string;

        switch (groupBy) {
          case 'day':
            key = date.toISOString().split('T')[0];
            break;
          case 'week':
            const weekStart = new Date(date);
            weekStart.setDate(date.getDate() - date.getDay());
            key = weekStart.toISOString().split('T')[0];
            break;
          case 'month':
            key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            break;
          default:
            key = date.toISOString().split('T')[0];
        }

        if (!acc[key]) {
          acc[key] = {
            date: key,
            revenue: 0,
            sessionCount: 0,
            avgSessionValue: 0,
          };
        }

        acc[key].revenue += payment.amount;
        acc[key].sessionCount += 1;

        return acc;
      }, {} as Record<string, any>);

      // Calculate averages
      Object.values(groupedData).forEach((data: any) => {
        data.avgSessionValue = data.revenue / data.sessionCount;
      });

      return {
        data: Object.values(groupedData),
        summary: {
          totalRevenue: payments.reduce((sum, p) => sum + p.amount, 0),
          totalSessions: payments.length,
          avgSessionValue: payments.length > 0
            ? payments.reduce((sum, p) => sum + p.amount, 0) / payments.length
            : 0,
        },
      };
    }),
});