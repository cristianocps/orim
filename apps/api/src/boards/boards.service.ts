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
  // null explicitly detaches a child from its parent; undefined leaves the
  // existing relation untouched so transient transform-only patches don't
  // accidentally orphan things.
  parentId: z.string().uuid().nullable().optional(),
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
        elements: {
          where: { deletedAt: null },
          // Sort parents before their children so the canvas engine sees a
          // valid tree on initial load (a child whose parent hasn't been
          // mounted yet would be silently parked under the root container
          // and could miss its real parent on subsequent rebuilds). Postgres
          // sorts NULLs last by default, so we explicitly ask for NULLs
          // first on `parentId` (top-level rows = root parents).
          orderBy: [
            { parentId: { sort: 'asc', nulls: 'first' } },
            { createdAt: 'asc' },
          ],
        },
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
    // Sort ops so parents are upserted before their children. Otherwise a
    // batch that creates a sticky_note + child text in one shot can fail
    // the parentId FK check if the child runs first. The ops are still
    // run inside a single $transaction so they're atomic — this only
    // controls the in-batch order.
    const sorted = sortByParentDependency(ops);

    const results = await this.prisma.$transaction(
      sorted.map((op) => {
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
              ...(op.parentId !== undefined ? { parentId: op.parentId } : {}),
            },
            update: {
              type: op.type,
              ...(op.data !== undefined ? { data: op.data as any } : {}),
              ...(op.transform !== undefined ? { transform: op.transform as any } : {}),
              ...(op.style !== undefined ? { style: op.style as any } : {}),
              ...(op.metadata !== undefined ? { metadata: op.metadata as any } : {}),
              // Allow re-parenting (or detaching with `null`) on update.
              ...(op.parentId !== undefined ? { parentId: op.parentId } : {}),
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
            ...(op.parentId !== undefined ? { parentId: op.parentId } : {}),
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

    // Cascade soft-delete down the parent/child tree. Without this, deleting
    // a sticky_note would leave its child text element orphaned, still
    // visible on reload and re-attaching to nothing. We collect descendants
    // breadth-first then mark them all deleted in one transaction.
    const ids = await this.collectDescendants(boardId, elementId);
    if (ids.length === 0) return { ok: true };

    await this.prisma.element.updateMany({
      where: { id: { in: ids }, boardId },
      data: { deletedAt: new Date() },
    });
    return { ok: true, deletedIds: ids };
  }

  private async collectDescendants(boardId: string, rootId: string): Promise<string[]> {
    const all: string[] = [rootId];
    let frontier: string[] = [rootId];
    // Defensive cap so a corrupted cycle (parent→child→grandchild→parent)
    // can't lock the request forever. Boards in practice are 5-6 levels
    // deep at most; 10 levels is very generous.
    for (let depth = 0; depth < 10 && frontier.length > 0; depth++) {
      const children = await this.prisma.element.findMany({
        where: { boardId, parentId: { in: frontier }, deletedAt: null },
        select: { id: true },
      });
      if (children.length === 0) break;
      const ids = children.map((c) => c.id);
      all.push(...ids);
      frontier = ids;
    }
    return all;
  }

  async getHistory(boardId: string) {
    return this.prisma.history.findMany({
      where: { boardId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }
}

/**
 * Order ops so each parent appears before its children. We use a simple
 * topological pass: items whose parentId is either null/undefined or refers
 * to an id that's NOT in the current op batch (i.e. parent already exists
 * in the DB) come first; then we keep emitting items whose parents have
 * already been emitted. Cycles fall through and just get appended at the
 * end so the FK error surfaces clearly instead of looping forever.
 */
function sortByParentDependency<T extends { id?: string; parentId?: string | null }>(ops: T[]): T[] {
  if (ops.length <= 1) return ops;
  const inBatch = new Set(ops.map((o) => o.id).filter(Boolean) as string[]);
  const emitted = new Set<string>();
  const out: T[] = [];
  const remaining = [...ops];
  let progress = true;
  while (remaining.length > 0 && progress) {
    progress = false;
    for (let i = remaining.length - 1; i >= 0; i--) {
      const op = remaining[i];
      const pid = op.parentId;
      const ready = pid == null || !inBatch.has(pid) || emitted.has(pid);
      if (ready) {
        out.push(op);
        if (op.id) emitted.add(op.id);
        remaining.splice(i, 1);
        progress = true;
      }
    }
  }
  // If anything is left it's a cycle — push as-is and let Postgres complain.
  return out.concat(remaining);
}
