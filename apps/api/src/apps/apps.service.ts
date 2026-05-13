import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

@Injectable()
export class AppsService {
  constructor(private prisma: PrismaService) {}

  async findAllPublished() {
    return this.prisma.app.findMany({
      where: {},
      include: { author: { select: { id: true, name: true } }, versions: { take: 1, orderBy: { createdAt: 'desc' } } },
    });
  }

  async findById(id: string) {
    const app = await this.prisma.app.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } }, versions: { orderBy: { createdAt: 'desc' } } },
    });
    if (!app) throw new NotFoundException('App not found');
    return app;
  }

  async create(userId: string, data: { name: string; description: string; iconUrl?: string; manifest: any; entryPoint: string }) {
    return this.prisma.app.create({
      data: {
        name: data.name,
        description: data.description,
        iconUrl: data.iconUrl,
        manifest: data.manifest as any,
        authorId: userId,
        versions: {
          create: { version: '1.0.0', entryPoint: data.entryPoint },
        },
      },
      include: { versions: true },
    });
  }

  async install(boardId: string, appId: string, userId: string, config?: any) {
    return this.prisma.appInstall.upsert({
      where: { appId_boardId: { appId, boardId } },
      create: { appId, boardId, installedBy: userId, config: config ?? {}, enabled: true },
      update: { enabled: true, config: config ?? {} },
      include: { app: { include: { versions: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    });
  }

  async uninstall(boardId: string, appId: string) {
    await this.prisma.appInstall.deleteMany({
      where: { appId, boardId },
    });
    return { ok: true };
  }

  async findInstalled(boardId: string) {
    return this.prisma.appInstall.findMany({
      where: { boardId, enabled: true },
      include: { app: { include: { versions: { take: 1, orderBy: { createdAt: 'desc' } } } } },
    });
  }

  async toggleInstall(installId: string, enabled: boolean) {
    return this.prisma.appInstall.update({
      where: { id: installId },
      data: { enabled },
    });
  }
}
