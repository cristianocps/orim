import { useEffect, useRef, useState } from 'react';
import './RemoteCursors.css';

interface Cursor {
  userId: string;
  name: string;
  color: string;
  x: number;
  y: number;
}

interface RemoteCursorsProps {
  socket: any; // Socket.io instance
}

export function RemoteCursors({ socket }: RemoteCursorsProps) {
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const pendingRef = useRef<Record<string, Cursor>>({});
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Each remote user can send up to ~60 cursor events/sec. Naively calling
    // setState per event triggers a React re-render of every <RemoteCursor>
    // many times per frame. We accumulate the latest cursor state per user
    // and flush once per animation frame.
    const flushPending = () => {
      rafRef.current = null;
      const pending = pendingRef.current;
      if (Object.keys(pending).length === 0) return;
      pendingRef.current = {};
      setCursors((prev) => ({ ...prev, ...pending }));
    };

    const onCursorMoved = (data: Cursor & { id?: string }) => {
      const uid = data.userId ?? data.id ?? '';
      pendingRef.current[uid] = { ...data, userId: uid };
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(flushPending);
    };

    const onUserLeft = ({ userId, id }: { userId?: string; id?: string }) => {
      const uid = userId ?? id ?? '';
      delete pendingRef.current[uid];
      setCursors((prev) => {
        const next = { ...prev };
        delete next[uid];
        return next;
      });
    };

    socket.on('cursor.moved', onCursorMoved);
    socket.on('user.left', onUserLeft);

    return () => {
      socket.off('cursor.moved', onCursorMoved);
      socket.off('user.left', onUserLeft);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [socket]);

  return (
    <div className="remote-cursors-layer">
      {Object.values(cursors).map((cursor) => (
        <div
          key={cursor.userId}
          className="remote-cursor"
          style={{
            left: cursor.x,
            top: cursor.y,
            color: cursor.color,
          }}
        >
          <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
            <path
              d="M2 2L2 18L6 14L10 22L14 20L10 12L16 12L2 2Z"
              fill={cursor.color}
              stroke="white"
              strokeWidth="1.5"
            />
          </svg>
          <span className="cursor-name" style={{ background: cursor.color }}>
            {cursor.name}
          </span>
        </div>
      ))}
    </div>
  );
}
