import Fastify from 'fastify';
import { PrismaClient } from '@prisma/client';
import Redis from 'ioredis';
import { createTRPCRouter } from './trpc';
import { authRouter } from './controllers/auth.controller';
import { tenantRouter } from './controllers/tenant.controller';
import { userRouter } from './controllers/user.controller';

const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  },
});

// Database and Redis clients
export const prisma = new PrismaClient();
export const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// Global error handler
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Health check
fastify.get('/health', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return { status: 'healthy', timestamp: new Date().toISOString() };
  } catch (error) {
    throw new Error('Service unhealthy');
  }
});

// Register plugins
async function registerPlugins() {
  // Security
  await fastify.register(import('@fastify/helmet'));
  await fastify.register(import('@fastify/cors'), {
    origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(import('@fastify/rate-limit'), {
    max: 100,
    timeWindow: '1 minute',
    redis: redis,
  });

  // JWT
  await fastify.register(import('@fastify/jwt'), {
    secret: process.env.JWT_SECRET || 'your-secret-key',
    sign: { expiresIn: '24h' },
  });
}

// Create main tRPC router
const appRouter = createTRPCRouter({
  auth: authRouter,
  tenant: tenantRouter,
  user: userRouter,
});

export type AppRouter = typeof appRouter;

// tRPC handler
fastify.all('/trpc/*', async (request, reply) => {
  const path = request.url.replace('/trpc/', '');
  const response = await appRouter.createCaller({
    req: request,
    res: reply,
    prisma,
    redis,
  })[path as keyof typeof appRouter](request.body);
  reply.send(response);
});

// Start server
async function start() {
  try {
    await registerPlugins();
    await fastify.listen({
      port: Number(process.env.PORT) || 3001,
      host: '0.0.0.0'
    });
    fastify.log.info('Auth service started on port 3001');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  fastify.log.info('Received SIGTERM, shutting down gracefully');
  await prisma.$disconnect();
  await redis.disconnect();
  await fastify.close();
  process.exit(0);
});

start();