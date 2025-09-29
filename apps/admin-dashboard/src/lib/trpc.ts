import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '../../../services/auth-service/src/index';

export const trpc = createTRPCReact<AppRouter>();