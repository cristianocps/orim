import { Module } from '@nestjs/common';
import { BoardsController } from './boards.controller.js';
import { BoardsService } from './boards.service.js';
import { PrismaModule } from '../prisma/prisma.module.js';

@Module({
  imports: [PrismaModule],
  controllers: [BoardsController],
  providers: [BoardsService],
  exports: [BoardsService],
})
export class BoardsModule {}
