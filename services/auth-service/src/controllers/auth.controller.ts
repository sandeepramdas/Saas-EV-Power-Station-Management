import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, publicProcedure, protectedProcedure } from '../trpc';
import { signJWT, refreshToken } from '../utils/jwt';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  tenantDomain: z.string().optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().optional(),
  tenantName: z.string().min(1),
  tenantType: z.enum(['STATION_OPERATOR', 'MANUFACTURER', 'NETWORK_PROVIDER', 'ENTERPRISE']),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const authRouter = createTRPCRouter({
  // Public login endpoint
  login: publicProcedure
    .input(loginSchema)
    .mutation(async ({ input, ctx }) => {
      const { email, password, tenantDomain } = input;

      // Find user
      const user = await ctx.prisma.user.findUnique({
        where: { email },
        include: {
          tenant: true,
        },
      });

      if (!user || !user.isActive) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Verify tenant domain if provided
      if (tenantDomain && user.tenant.domain !== tenantDomain) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid tenant domain',
        });
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password!);
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid credentials',
        });
      }

      // Generate JWT token
      const token = signJWT({
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
      });

      // Update last login
      await ctx.prisma.user.update({
        where: { id: user.id },
        data: { lastLoginAt: new Date() },
      });

      // Store session in Redis
      await ctx.redis.setex(`session:${user.id}`, 86400, token);

      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          tenant: {
            id: user.tenant.id,
            name: user.tenant.name,
            type: user.tenant.type,
          },
        },
      };
    }),

  // Public registration endpoint
  register: publicProcedure
    .input(registerSchema)
    .mutation(async ({ input, ctx }) => {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        tenantName,
        tenantType,
      } = input;

      // Check if user already exists
      const existingUser = await ctx.prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'User already exists',
        });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create tenant and user in transaction
      const result = await ctx.prisma.$transaction(async (tx) => {
        // Create tenant
        const tenant = await tx.tenant.create({
          data: {
            name: tenantName,
            type: tenantType,
            isActive: true,
          },
        });

        // Create admin user
        const user = await tx.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            role: 'TENANT_ADMIN',
            tenantId: tenant.id,
            isActive: true,
          },
        });

        return { tenant, user };
      });

      // Generate JWT token
      const token = signJWT({
        userId: result.user.id,
        tenantId: result.tenant.id,
        role: result.user.role,
      });

      return {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
          tenant: {
            id: result.tenant.id,
            name: result.tenant.name,
            type: result.tenant.type,
          },
        },
      };
    }),

  // Protected: Get current user
  me: protectedProcedure
    .query(async ({ ctx }) => {
      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user!.id },
        include: {
          tenant: true,
        },
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      return {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        lastLoginAt: user.lastLoginAt,
        tenant: {
          id: user.tenant.id,
          name: user.tenant.name,
          type: user.tenant.type,
          domain: user.tenant.domain,
        },
      };
    }),

  // Protected: Refresh token
  refresh: protectedProcedure
    .mutation(async ({ ctx }) => {
      const token = ctx.req.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'No token provided',
        });
      }

      try {
        const newToken = refreshToken(token);

        // Update session in Redis
        await ctx.redis.setex(`session:${ctx.user!.id}`, 86400, newToken);

        return { token: newToken };
      } catch (error) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid token',
        });
      }
    }),

  // Protected: Logout
  logout: protectedProcedure
    .mutation(async ({ ctx }) => {
      // Remove session from Redis
      await ctx.redis.del(`session:${ctx.user!.id}`);
      return { success: true };
    }),

  // Protected: Change password
  changePassword: protectedProcedure
    .input(changePasswordSchema)
    .mutation(async ({ input, ctx }) => {
      const { currentPassword, newPassword } = input;

      const user = await ctx.prisma.user.findUnique({
        where: { id: ctx.user!.id },
      });

      if (!user || !user.password) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found',
        });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Invalid current password',
        });
      }

      // Hash new password
      const hashedNewPassword = await bcrypt.hash(newPassword, 12);

      // Update password
      await ctx.prisma.user.update({
        where: { id: ctx.user!.id },
        data: { password: hashedNewPassword },
      });

      return { success: true };
    }),
});