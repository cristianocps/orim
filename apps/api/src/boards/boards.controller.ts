import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { BoardsService } from './boards.service.js';

@Controller('boards')
@UseGuards(JwtAuthGuard)
export class BoardsController {
  constructor(private boardsService: BoardsService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.boardsService.findAll(req.user.userId);
  }

  @Post()
  create(@Body() body: any, @Req() req: any) {
    return this.boardsService.create(req.user.userId, body.name, body.description);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    return this.boardsService.findOne(id, req.user.userId);
  }

  @Patch(':id/elements')
  patchElements(@Param('id') id: string, @Body() body: unknown, @Req() req: any) {
    return this.boardsService.patchElements(id, req.user.userId, body);
  }

  @Delete(':id/elements/:elementId')
  deleteElement(
    @Param('id') id: string,
    @Param('elementId') elementId: string,
    @Req() req: any,
  ) {
    return this.boardsService.deleteElement(id, req.user.userId, elementId);
  }

  @Get(':id/history')
  getHistory(@Param('id') id: string) {
    return this.boardsService.getHistory(id);
  }
}
