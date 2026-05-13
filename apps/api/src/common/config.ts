import dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(process.cwd(), '.env') });

export const config = {
  port: Number(process.env.PORT ?? 3001),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL!,
  redisUrl: process.env.REDIS_URL!,
  jwtSecret: process.env.JWT_SECRET!,
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET!,
  cookieSecret: process.env.COOKIE_SECRET!,
  minio: {
    endPoint: process.env.MINIO_ENDPOINT!,
    port: Number(process.env.MINIO_PORT ?? 9000),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY!,
    secretKey: process.env.MINIO_SECRET_KEY!,
    bucket: process.env.MINIO_BUCKET!,
  },
};
