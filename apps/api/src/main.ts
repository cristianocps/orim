import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import { AppModule } from './app.module.js';
import { config } from './common/config.js';
import { GlobalExceptionFilter } from './common/http-exception.filter.js';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  app.useGlobalFilters(new GlobalExceptionFilter());

  await app.register(cors, { origin: true, credentials: true });
  await app.register(cookie, { secret: config.cookieSecret });
  await app.register(multipart);

  await app.listen(config.port, '0.0.0.0');
  console.log(`Server running at http://localhost:${config.port}`);
}

bootstrap();
