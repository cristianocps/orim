import { useEffect } from 'react';
import { StickyNote, Type, Square, Circle, CreditCard, Frame as FrameIcon } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import './QuickCreateMenu.css';

interface QuickCreateMenuProps {
  engine: CanvasEngine | null;
  open: { connectorId: string; screenPoint: { x: number; y: number } } | null;
  onClose: () => void;
}

const OPTIONS = [
  { id: 'sticky_note', label: 'Sticky', icon: StickyNote },
  { id: 'card', label: 'Card', icon: CreditCard },
  { id: 'text', label: 'Texto', icon: Type },
  { id: 'rectangle', label: 'Retângulo', icon: Square },
  { id: 'circle', label: 'Círculo', icon: Circle },
  { id: 'frame', label: 'Frame', icon: FrameIcon },
];

export function QuickCreateMenu({ engine, open, onClose }: QuickCreateMenuProps) {
  const { addElement, updateElement } = useBoardStore();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !engine) return null;

  const handleCreate = (type: string) => {
    const world = engine.screenToWorld({ x: open.screenPoint.x, y: open.screenPoint.y });
    const el = engine.insertElementAt(type === 'sticky' ? 'sticky_note' : type, world);
    if (!el) {
      onClose();
      return;
    }
    addElement(el, true);
    // Re-anchor connector's end to this new element. We try to pick the
    // anchor that best faces the connector's source (or just use the world
    // drop point) instead of always defaulting to the left side.
    const conn = engine.getElement(open.connectorId) as any;
    if (conn) {
      const anchor = engine.computeNearestAnchor(el.id, world) ?? 'center';
      updateElement(open.connectorId, {
        to: { kind: 'element', elementId: el.id, anchorId: anchor },
      } as any);
    }
    onClose();
  };

  return (
    <div
      className="quick-create-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="quick-create"
        style={{
          position: 'fixed',
          left: open.screenPoint.x + 8,
          top: open.screenPoint.y + 8,
        }}
      >
        <div className="quick-create-title">Criar e conectar</div>
        {OPTIONS.map((opt) => (
          <button key={opt.id} className="quick-create-item" onClick={() => handleCreate(opt.id)}>
            <opt.icon size={14} />
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
