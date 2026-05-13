import { Module } from '@nestjs/common';
import { BoardGateway } from './board.gateway.js';
import { BoardsModule } from '../boards/boards.module.js';

@Module({
  imports: [BoardsModule],
  providers: [BoardGateway],
})
export class SocketsModule {}
