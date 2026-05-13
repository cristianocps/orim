import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Inject } from '@nestjs/common';
import { redis } from '../common/redis.js';
import { BoardsService } from '../boards/boards.service.js';

interface UserInfo {
  id: string;       // socket id
  userId: string;   // app user id
  name: string;
  color: string;
  x: number;
  y: number;
  boardId: string | null;
  selection: string[];
}

const COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#d946ef', '#f43f5e',
];

async function assignColor(userId: string): Promise<string> {
  const key = `user_color:${userId}`;
  const existing = await redis.get(key);
  if (existing) return existing;
  const color = COLORS[Math.floor(Math.random() * COLORS.length)];
  await redis.setex(key, 86400 * 30, color);
  return color;
}

@WebSocketGateway({
  cors: { origin: 'http://localhost:3000', credentials: true },
})
export class BoardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private users = new Map<string, UserInfo>();

  constructor(@Inject(BoardsService) private readonly boardsService: BoardsService) {}

  async handleConnection(client: Socket) {
    void client;
  }

  async handleDisconnect(client: Socket) {
    const user = this.users.get(client.id);
    if (user?.boardId) {
      client.to(user.boardId).emit('user.left', { userId: user.userId });
    }
    this.users.delete(client.id);
  }

  @SubscribeMessage('board:join')
  async handleJoin(client: Socket, payload: { boardId: string; userId: string; name: string }) {
    const { boardId, userId, name } = payload;
    await client.join(boardId);
    const color = await assignColor(userId);
    const user: UserInfo = {
      id: client.id,
      userId,
      name,
      color,
      x: 0,
      y: 0,
      boardId,
      selection: [],
    };
    this.users.set(client.id, user);
    client.to(boardId).emit('user.joined', { userId, name, color });
    const others = Array.from(this.users.values())
      .filter((u) => u.boardId === boardId && u.id !== client.id)
      .map((u) => ({ userId: u.userId, name: u.name, color: u.color }));
    client.emit('users.list', others);
  }

  @SubscribeMessage('board:leave')
  handleLeave(client: Socket, payload: { boardId: string }) {
    client.leave(payload.boardId);
    const user = this.users.get(client.id);
    if (user) {
      user.boardId = null;
      client.to(payload.boardId).emit('user.left', { userId: user.userId });
    }
  }

  @SubscribeMessage('cursor:move')
  handleCursorMove(client: Socket, payload: { boardId: string; x: number; y: number }) {
    const user = this.users.get(client.id);
    if (!user) return;
    user.x = payload.x;
    user.y = payload.y;
    client.to(payload.boardId).emit('cursor.moved', {
      userId: user.userId,
      x: payload.x,
      y: payload.y,
      name: user.name,
      color: user.color,
    });
  }

  @SubscribeMessage('selection:changed')
  handleSelectionChanged(client: Socket, payload: { boardId: string; ids: string[] }) {
    const user = this.users.get(client.id);
    if (!user) return;
    user.selection = payload.ids ?? [];
    client.to(payload.boardId).emit('selection.changed', {
      userId: user.userId,
      ids: user.selection,
      color: user.color,
      name: user.name,
    });
  }

  @SubscribeMessage('element:created')
  async handleElementCreated(
    client: Socket,
    payload: { boardId: string; element: any },
  ) {
    const user = this.users.get(client.id);
    if (!user) return;
    client.to(payload.boardId).emit('element.created', payload.element);
    try {
      await this.boardsService.patchElements(payload.boardId, user.userId, [
        toServerOp(payload.element),
      ]);
    } catch (e) {
      // intentionally swallow — REST fallback will retry
      console.warn('WS persistence failed (created):', (e as Error).message);
    }
  }

  @SubscribeMessage('element:updated')
  async handleElementUpdated(
    client: Socket,
    payload: { boardId: string; id: string; patch: any },
  ) {
    const user = this.users.get(client.id);
    if (!user) return;
    client.to(payload.boardId).emit('element.updated', { id: payload.id, patch: payload.patch });
  }

  @SubscribeMessage('element:transient')
  handleElementTransient(
    client: Socket,
    payload: { boardId: string; id: string; transform: any },
  ) {
    client.to(payload.boardId).emit('element.transient', { id: payload.id, transform: payload.transform });
  }

  @SubscribeMessage('element:deleted')
  handleElementDeleted(client: Socket, payload: { boardId: string; elementId: string }) {
    client.to(payload.boardId).emit('element.deleted', { id: payload.elementId });
  }

  @SubscribeMessage('viewport:update')
  handleViewportUpdate(client: Socket, payload: { boardId: string; x: number; y: number; zoom: number }) {
    const user = this.users.get(client.id);
    if (!user) return;
    client.to(payload.boardId).emit('viewport.updated', {
      userId: user.userId,
      x: payload.x,
      y: payload.y,
      zoom: payload.zoom,
      name: user.name,
      color: user.color,
    });
  }

  @SubscribeMessage('follow:start')
  handleFollowStart(client: Socket, payload: { boardId: string; targetUserId: string }) {
    const user = this.users.get(client.id);
    if (!user) return;
    client.to(payload.boardId).emit('follow.started', {
      followerId: user.userId,
      targetUserId: payload.targetUserId,
    });
  }

  @SubscribeMessage('follow:stop')
  handleFollowStop(client: Socket, payload: { boardId: string }) {
    const user = this.users.get(client.id);
    if (!user) return;
    client.to(payload.boardId).emit('follow.stopped', { followerId: user.userId });
  }

  @SubscribeMessage('timer:start')
  handleTimerStart(client: Socket, payload: { boardId: string; duration: number }) {
    client.to(payload.boardId).emit('timer.started', { duration: payload.duration, startedBy: client.id });
  }

  @SubscribeMessage('timer:stop')
  handleTimerStop(client: Socket, payload: { boardId: string }) {
    client.to(payload.boardId).emit('timer.stopped', { stoppedBy: client.id });
  }

  @SubscribeMessage('vote:add')
  handleVoteAdd(client: Socket, payload: { boardId: string; elementId: string }) {
    client.to(payload.boardId).emit('vote.added', { elementId: payload.elementId, userId: client.id });
  }

  @SubscribeMessage('reaction:send')
  handleReaction(client: Socket, payload: { boardId: string; emoji: string; x: number; y: number }) {
    client.to(payload.boardId).emit('reaction.sent', {
      emoji: payload.emoji,
      x: payload.x,
      y: payload.y,
      userId: client.id,
    });
  }
}

function toServerOp(el: any) {
  const { id, type, transform, style, metadata, ...rest } = el ?? {};
  return {
    id,
    type,
    transform,
    style: style ?? {},
    metadata: metadata ?? {},
    data: extractData(rest),
  };
}

function extractData(rest: any): Record<string, unknown> {
  const { createdBy, updatedAt, parentId, ...data } = rest ?? {};
  void createdBy; void updatedAt; void parentId;
  return data;
}
