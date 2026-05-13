import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { z } from 'zod';

const opSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string(),
  data: z.record(z.unknown()).optional(),
  transform: z.record(z.unknown()).optional(),
  style: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});
const patchElementsSchema = z.array(opSchema);

@Injectable()
export class BoardsService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: string) {
    const memberships = await this.prisma.boardMember.findMany({
      where: { userId },
      include: { board: true },
    });
    return memberships.map((m) => m.board);
  }

  async create(userId: string, name: string, description?: string) {
    return this.prisma.board.create({
      data: {
        name,
        description,
        ownerId: userId,
        members: { create: { userId, role: 'owner' } },
      },
    });
  }

  async findOne(id: string, userId?: string) {
    const board = await this.prisma.board.findUnique({
      where: { id },
      include: {
        elements: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } } },
      },
    });
    if (!board) throw new NotFoundException();
    if (userId && !board.members.some((m) => m.userId === userId)) {
      // Allow owner to view their own boards even if missing membership row
      if (board.ownerId !== userId) throw new ForbiddenException();
    }
    return board;
  }

  private async assertCanEdit(boardId: string, userId: string) {
    const member = await this.prisma.boardMember.findFirst({
      where: { boardId, userId },
    });
    if (!member) {
      const board = await this.prisma.board.findUnique({ where: { id: boardId } });
      if (board?.ownerId !== userId) {
        throw new ForbiddenException('Você não tem permissão para editar este board');
      }
    } else if (member.role === 'viewer') {
      throw new ForbiddenException('Visualizadores não podem editar');
    }
  }

  async patchElements(boardId: string, userId: string, body: unknown) {
    await this.assertCanEdit(boardId, userId);
    const ops = patchElementsSchema.parse(body);
    if (ops.length === 0) return [];
    const results = await this.prisma.$transaction(
      ops.map((op) => {
        if (op.id) {
          return this.prisma.element.upsert({
            where: { id: op.id },
            create: {
              id: op.id,
              type: op.type,
              data: (op.data ?? {}) as any,
              transform: (op.transform ?? {}) as any,
              style: (op.style ?? {}) as any,
              metadata: (op.metadata ?? {}) as any,
              boardId,
              createdBy: userId,
            },
            update: {
              type: op.type,
              ...(op.data !== undefined ? { data: op.data as any } : {}),
              ...(op.transform !== undefined ? { transform: op.transform as any } : {}),
              ...(op.style !== undefined ? { style: op.style as any } : {}),
              ...(op.metadata !== undefined ? { metadata: op.metadata as any } : {}),
            },
          });
        }
        return this.prisma.element.create({
          data: {
            type: op.type,
            data: (op.data ?? {}) as any,
            transform: (op.transform ?? {}) as any,
            style: (op.style ?? {}) as any,
            metadata: (op.metadata ?? {}) as any,
            boardId,
            createdBy: userId,
          },
        });
      }),
    );

    await this.prisma.history.create({
      data: {
        action: 'elements.patch',
        payload: { ops } as any,
        boardId,
        userId,
      },
    });

    return results;
  }

  async deleteElement(boardId: string, userId: string, elementId: string) {
    await this.assertCanEdit(boardId, userId);
    await this.prisma.element.updateMany({
      where: { id: elementId, boardId },
      data: { deletedAt: new Date() },
    });
    return { ok: true };
  }

  async getHistory(boardId: string) {
    return this.prisma.history.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}
