import { useEffect, useState } from 'react';
import type { CanvasEngine } from '../canvas/engine.js';
import type { RemoteSelection } from '../hooks/useSocket.js';
import './RemoteSelections.css';

interface RemoteSelectionsProps {
  engine: CanvasEngine | null;
  selections: RemoteSelection[];
}

interface RemoteRect {
  userId: string;
  color: string;
  name: string;
  rect: { left: number; top: number; width: number; height: number };
  elementId: string;
}

export function RemoteSelections({ engine, selections }: RemoteSelectionsProps) {
  const [rects, setRects] = useState<RemoteRect[]>([]);

  useEffect(() => {
    if (!engine) {
      setRects([]);
      return;
    }
    let lastSerialized = '';
    const compute = () => {
      const next: RemoteRect[] = [];
      for (const sel of selections) {
        for (const id of sel.ids) {
          const r = engine.getElementScreenRect(id);
          if (r) {
            next.push({
              userId: sel.userId,
              color: sel.color,
              name: sel.name,
              rect: { left: r.left, top: r.top, width: r.width, height: r.height },
              elementId: id,
            });
          }
        }
      }
      const serialized = JSON.stringify(next);
      if (serialized !== lastSerialized) {
        lastSerialized = serialized;
        setRects(next);
      }
    };
    compute();
    const interval = window.setInterval(compute, 200);
    return () => window.clearInterval(interval);
  }, [engine, selections]);

  return (
    <div className="remote-selections">
      {rects.map((r) => (
        <div
          key={`${r.userId}:${r.elementId}`}
          className="remote-selection-rect"
          style={{
            position: 'fixed',
            left: r.rect.left - 4,
            top: r.rect.top - 4,
            width: r.rect.width + 8,
            height: r.rect.height + 8,
            borderColor: r.color,
          }}
        >
          <div className="remote-selection-label" style={{ background: r.color }}>
            {r.name}
          </div>
        </div>
      ))}
    </div>
  );
}
