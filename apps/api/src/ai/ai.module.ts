import { Module } from '@nestjs/common';
import { AIController } from './ai.controller.js';
import { AIService } from './ai.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [AIController],
  providers: [AIService],
})
export class AIModule {}
