import { initTRPC, TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { FastifyRequest, FastifyReply } from 'fastify';
import { verifyJWT } from './utils/jwt';
import { z } from 'zod';

export interface Context {
  req: FastifyRequest;
  res: FastifyReply;
  prisma: PrismaClient;
  redis: Redis;
  user?: {
    id: string;
    tenantId: string;
    role: string;
  };
}

const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        code: error.code,
      },
    };
  },
});

// Base middleware for auth
const authMiddleware = t.middleware(async ({ ctx, next }) => {
  const token = ctx.req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'No token provided',
    });
  }

  try {
    const decoded = verifyJWT(token);
    const user = await ctx.prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true },
    });

    if (!user || !user.isActive) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Invalid user',
      });
    }

    ctx.user = {
      id: user.id,
      tenantId: user.tenantId,
      role: user.role,
    };

    return next({ ctx });
  } catch (error) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Invalid token',
    });
  }
});

// Role-based middleware
const adminMiddleware = authMiddleware.unstable_pipe(({ ctx, next }) => {
  if (!['SUPER_ADMIN', 'TENANT_ADMIN'].includes(ctx.user!.role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Admin access required',
    });
  }
  return next({ ctx });
});

// Tenant isolation middleware
const tenantMiddleware = authMiddleware.unstable_pipe(({ ctx, next }) => {
  // Add tenant filter to all queries
  const originalPrisma = ctx.prisma;

  // Override Prisma methods to include tenant filter
  ctx.prisma = new Proxy(originalPrisma, {
    get(target, prop) {
      const original = target[prop as keyof typeof target];

      if (typeof original === 'object' && original !== null) {
        return new Proxy(original, {
          get(modelTarget, modelProp) {
            const modelMethod = modelTarget[modelProp as keyof typeof modelTarget];

            if (typeof modelMethod === 'function' &&
                ['findMany', 'findFirst', 'findUnique', 'count', 'aggregate'].includes(modelProp as string)) {
              return function(args: any = {}) {
                // Add tenant filter to where clause
                if (args.where) {
                  args.where.tenantId = ctx.user!.tenantId;
                } else {
                  args.where = { tenantId: ctx.user!.tenantId };
                }
                return modelMethod.call(modelTarget, args);
              };
            }

            return modelMethod;
          }
        });
      }

      return original;
    }
  });

  return next({ ctx });
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(authMiddleware);
export const adminProcedure = t.procedure.use(adminMiddleware);
export const tenantProcedure = t.procedure.use(tenantMiddleware);