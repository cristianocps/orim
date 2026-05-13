import { useEffect, useRef, useState, useCallback } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useAuth } from '../contexts/AuthContext.js';
import { useBoardStore } from '../stores/boardStore.js';
import type { CanvasElement } from '@orim/shared';

export interface OnlineUser {
  userId: string;
  name: string;
  color: string;
}

export interface RemoteSelection {
  userId: string;
  ids: string[];
  color: string;
  name: string;
}

export function useSocket(boardId: string = 'demo-board'): {
  socket: Socket | null;
  onlineUsers: OnlineUser[];
  followingUserId: string | null;
  remoteSelections: RemoteSelection[];
  sendViewport: (x: number, y: number, zoom: number) => void;
  sendSelection: (ids: string[]) => void;
  startFollowing: (targetUserId: string) => void;
  stopFollowing: () => void;
} {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [followingUserId, setFollowingUserId] = useState<string | null>(null);
  const [remoteSelections, setRemoteSelections] = useState<RemoteSelection[]>([]);
  const { addElement, updateElement, removeElement, getEngine, applyRemote } = useBoardStore();
  const { user } = useAuth();
  const followingRef = useRef<string | null>(null);

  useEffect(() => {
    followingRef.current = followingUserId;
  }, [followingUserId]);

  useEffect(() => {
    const s = io('/', { transports: ['websocket'], withCredentials: true });
    setSocket(s);

    s.on('connect', () => {
      s.emit('board:join', {
        boardId,
        userId: user?.id ?? 'local-user',
        name: user?.name ?? 'Você',
      });
    });

    s.on('users.list', (users: OnlineUser[]) => setOnlineUsers(users));

    s.on('user.joined', (u: OnlineUser) => {
      setOnlineUsers((prev) => (prev.find((x) => x.userId === u.userId) ? prev : [...prev, u]));
    });

    s.on('user.left', ({ userId }: { userId: string }) => {
      setOnlineUsers((prev) => prev.filter((u) => u.userId !== userId));
      setRemoteSelections((prev) => prev.filter((sel) => sel.userId !== userId));
    });

    s.on('element.created', (el: CanvasElement) => {
      applyRemote(() => addElement(el, true));
    });

    s.on('element.updated', ({ id, patch }: { id: string; patch: Partial<CanvasElement> }) => {
      applyRemote(() => updateElement(id, patch, true));
    });

    s.on('element.deleted', ({ id }: { id: string }) => {
      applyRemote(() => removeElement(id, true));
    });

    // Coalesce remote transient updates: if multiple updates for the same
    // element arrive within a frame (very common during a fast remote drag),
    // we only apply the latest one. This avoids running the full
    // `engine.updateElement` pipeline (which touches incident connectors and
    // re-renders selection) tens of times per frame per element.
    const remoteTransientPending = new Map<string, any>();
    let remoteTransientRaf: number | null = null;
    const flushRemoteTransient = () => {
      remoteTransientRaf = null;
      const engine = getEngine();
      if (!engine) {
        remoteTransientPending.clear();
        return;
      }
      remoteTransientPending.forEach((transform, id) => {
        engine.updateElement(id, { transform } as any, { skipEmit: true });
      });
      remoteTransientPending.clear();
    };
    s.on('element.transient', ({ id, transform }: { id: string; transform: any }) => {
      remoteTransientPending.set(id, transform);
      if (remoteTransientRaf === null) {
        remoteTransientRaf = requestAnimationFrame(flushRemoteTransient);
      }
    });

    s.on('selection.changed', (sel: RemoteSelection) => {
      setRemoteSelections((prev) => {
        const others = prev.filter((s) => s.userId !== sel.userId);
        if (sel.ids.length === 0) return others;
        return [...others, sel];
      });
    });

    return () => {
      if (remoteTransientRaf !== null) cancelAnimationFrame(remoteTransientRaf);
      s.disconnect();
    };
  }, [boardId, addElement, updateElement, removeElement, getEngine, applyRemote, user]);

  const sendViewport = useCallback(
    (x: number, y: number, zoom: number) => {
      if (!socket || followingRef.current) return;
      socket.emit('viewport:update', { boardId, x, y, zoom });
    },
    [socket, boardId],
  );

  const sendSelection = useCallback(
    (ids: string[]) => {
      if (!socket) return;
      socket.emit('selection:changed', { boardId, ids });
    },
    [socket, boardId],
  );

  const startFollowing = useCallback(
    (targetUserId: string) => {
      if (!socket) return;
      setFollowingUserId(targetUserId);
      socket.emit('follow:start', { boardId, targetUserId });
    },
    [socket, boardId],
  );

  const stopFollowing = useCallback(() => {
    if (!socket) return;
    setFollowingUserId(null);
    socket.emit('follow:stop', { boardId });
  }, [socket, boardId]);

  return {
    socket,
    onlineUsers,
    followingUserId,
    remoteSelections,
    sendViewport,
    sendSelection,
    startFollowing,
    stopFollowing,
  };
}
