import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { createTRPCRouter, protectedProcedure, tenantProcedure } from '../trpc';

const createStationSchema = z.object({
  name: z.string().min(1),
  address: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  totalPorts: z.number().min(1).max(50),
  amenities: z.array(z.string()),
  pricing: z.object({
    baseRate: z.number().min(0),
    peakMultiplier: z.number().min(1),
    peakHours: z.array(z.number().min(0).max(23)),
  }),
});

const updateStationSchema = createStationSchema.partial().extend({
  id: z.string(),
});

const addChargingPortSchema = z.object({
  stationId: z.string(),
  portNumber: z.number().min(1),
  connectorType: z.enum(['TYPE1', 'TYPE2', 'CCS1', 'CCS2', 'CHAdeMO', 'TESLA', 'NACS']),
  powerOutput: z.number().min(1).max(350), // kW
});

const updatePortStatusSchema = z.object({
  portId: z.string(),
  status: z.enum(['AVAILABLE', 'OCCUPIED', 'RESERVED', 'OUT_OF_ORDER', 'MAINTENANCE']),
});

const nearbyStationsSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  radius: z.number().min(0.1).max(100).default(10), // km
  connectorType: z.enum(['TYPE1', 'TYPE2', 'CCS1', 'CCS2', 'CHAdeMO', 'TESLA', 'NACS']).optional(),
  availableOnly: z.boolean().default(false),
});

export const stationRouter = createTRPCRouter({
  // Create new station (tenant-specific)
  create: tenantProcedure
    .input(createStationSchema)
    .mutation(async ({ input, ctx }) => {
      const station = await ctx.prisma.station.create({
        data: {
          ...input,
          tenantId: ctx.user!.tenantId,
        },
        include: {
          chargingPorts: true,
        },
      });

      return station;
    }),

  // Get stations for current tenant
  list: tenantProcedure
    .input(z.object({
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
      search: z.string().optional(),
    }))
    .query(async ({ input, ctx }) => {
      const { page, limit, search } = input;
      const offset = (page - 1) * limit;

      const where = {
        tenantId: ctx.user!.tenantId,
        ...(search && {
          OR: [
            { name: { contains: search, mode: 'insensitive' as const } },
            { address: { contains: search, mode: 'insensitive' as const } },
          ],
        }),
      };

      const [stations, total] = await Promise.all([
        ctx.prisma.station.findMany({
          where,
          include: {
            chargingPorts: {
              include: {
                _count: {
                  select: {
                    sessions: {
                      where: {
                        status: 'ACTIVE',
                      },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: offset,
          take: limit,
        }),
        ctx.prisma.station.count({ where }),
      ]);

      return {
        stations: stations.map(station => ({
          ...station,
          availablePorts: station.chargingPorts.filter(port =>
            port.status === 'AVAILABLE'
          ).length,
          occupiedPorts: station.chargingPorts.filter(port =>
            port.status === 'OCCUPIED'
          ).length,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    }),

  // Get station details
  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const station = await ctx.prisma.station.findUnique({
        where: { id: input.id },
        include: {
          chargingPorts: {
            include: {
              sessions: {
                where: { status: 'ACTIVE' },
                include: { user: true, vehicle: true },
              },
              telemetry: {
                orderBy: { timestamp: 'desc' },
                take: 1,
              },
            },
          },
          analytics: {
            orderBy: { date: 'desc' },
            take: 30, // Last 30 days
          },
        },
      });

      if (!station) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Station not found',
        });
      }

      return station;
    }),

  // Update station
  update: tenantProcedure
    .input(updateStationSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;

      const station = await ctx.prisma.station.update({
        where: {
          id,
          tenantId: ctx.user!.tenantId, // Ensure tenant owns station
        },
        data,
        include: {
          chargingPorts: true,
        },
      });

      return station;
    }),

  // Delete station
  delete: tenantProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      await ctx.prisma.station.delete({
        where: {
          id: input.id,
          tenantId: ctx.user!.tenantId,
        },
      });

      return { success: true };
    }),

  // Add charging port to station
  addPort: tenantProcedure
    .input(addChargingPortSchema)
    .mutation(async ({ input, ctx }) => {
      const { stationId, ...portData } = input;

      // Verify station ownership
      const station = await ctx.prisma.station.findFirst({
        where: {
          id: stationId,
          tenantId: ctx.user!.tenantId,
        },
      });

      if (!station) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Station not found',
        });
      }

      const port = await ctx.prisma.chargingPort.create({
        data: {
          ...portData,
          stationId,
          status: 'AVAILABLE',
        },
      });

      return port;
    }),

  // Update port status
  updatePortStatus: protectedProcedure
    .input(updatePortStatusSchema)
    .mutation(async ({ input, ctx }) => {
      const { portId, status } = input;

      const port = await ctx.prisma.chargingPort.update({
        where: { id: portId },
        data: { status },
      });

      // Emit real-time update via WebSocket
      ctx.io?.emit(`port:${portId}:status`, { portId, status });

      return port;
    }),

  // Find nearby stations (public endpoint)
  findNearby: protectedProcedure
    .input(nearbyStationsSchema)
    .query(async ({ input, ctx }) => {
      const { latitude, longitude, radius, connectorType, availableOnly } = input;

      // Haversine formula for distance calculation
      const stations = await ctx.prisma.$queryRaw`
        SELECT
          s.*,
          (
            6371 * acos(
              cos(radians(${latitude})) *
              cos(radians(s.latitude)) *
              cos(radians(s.longitude) - radians(${longitude})) +
              sin(radians(${latitude})) *
              sin(radians(s.latitude))
            )
          ) AS distance
        FROM stations s
        WHERE s.is_active = true
        HAVING distance < ${radius}
        ORDER BY distance
        LIMIT 50
      ` as any[];

      // Get charging ports and availability for each station
      const stationsWithPorts = await Promise.all(
        stations.map(async (station) => {
          const ports = await ctx.prisma.chargingPort.findMany({
            where: {
              stationId: station.id,
              ...(connectorType && { connectorType }),
              ...(availableOnly && { status: 'AVAILABLE' }),
            },
          });

          return {
            ...station,
            chargingPorts: ports,
            availablePorts: ports.filter(p => p.status === 'AVAILABLE').length,
            totalPorts: ports.length,
          };
        })
      );

      return stationsWithPorts.filter(station =>
        !availableOnly || station.availablePorts > 0
      );
    }),

  // Get real-time station stats
  getRealtimeStats: tenantProcedure
    .input(z.object({ stationId: z.string() }))
    .query(async ({ input, ctx }) => {
      const { stationId } = input;

      const station = await ctx.prisma.station.findFirst({
        where: {
          id: stationId,
          tenantId: ctx.user!.tenantId,
        },
        include: {
          chargingPorts: {
            include: {
              sessions: {
                where: { status: 'ACTIVE' },
              },
            },
          },
        },
      });

      if (!station) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Station not found',
        });
      }

      const activeSessions = station.chargingPorts.flatMap(port => port.sessions);
      const totalRevenue = activeSessions.reduce((sum, session) => sum + (session.cost || 0), 0);
      const totalEnergy = activeSessions.reduce((sum, session) => sum + (session.energyUsed || 0), 0);

      return {
        totalPorts: station.chargingPorts.length,
        availablePorts: station.chargingPorts.filter(p => p.status === 'AVAILABLE').length,
        occupiedPorts: station.chargingPorts.filter(p => p.status === 'OCCUPIED').length,
        outOfOrderPorts: station.chargingPorts.filter(p => p.status === 'OUT_OF_ORDER').length,
        activeSessions: activeSessions.length,
        totalRevenue,
        totalEnergy,
        utilizationRate: station.chargingPorts.filter(p => p.status === 'OCCUPIED').length / station.chargingPorts.length,
      };
    }),
});