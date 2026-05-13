import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { BoardsModule } from './boards/boards.module.js';
import { UploadModule } from './upload/upload.module.js';
import { AIModule } from './ai/ai.module.js';
import { SocketsModule } from './sockets/sockets.module.js';
import { HealthModule } from './health/health.module.js';
import { AppsModule } from './apps/apps.module.js';

@Module({
  imports: [PrismaModule, AuthModule, BoardsModule, UploadModule, AIModule, SocketsModule, HealthModule, AppsModule],
})
export class AppModule {}
