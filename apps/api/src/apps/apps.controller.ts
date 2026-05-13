import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AppsService } from './apps.service.js';

@Controller('apps')
export class AppsController {
  constructor(private appsService: AppsService) {}

  @Get()
  findAll() {
    return this.appsService.findAllPublished();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.appsService.findById(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() body: any, @Req() req: any) {
    return this.appsService.create(req.user.userId, body);
  }

  @Post(':id/install')
  @UseGuards(JwtAuthGuard)
  install(@Param('id') appId: string, @Body() body: any, @Req() req: any) {
    return this.appsService.install(body.boardId, appId, req.user.userId, body.config);
  }

  @Delete(':id/install')
  @UseGuards(JwtAuthGuard)
  uninstall(@Param('id') appId: string, @Body() body: any) {
    return this.appsService.uninstall(body.boardId, appId);
  }

  @Get('board/:boardId/installed')
  @UseGuards(JwtAuthGuard)
  findInstalled(@Param('boardId') boardId: string) {
    return this.appsService.findInstalled(boardId);
  }
}
