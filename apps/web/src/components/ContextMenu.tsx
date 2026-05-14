import { useEffect, useMemo, useRef } from 'react';
import { useBoardStore } from '../stores/boardStore.js';
import {
  contextActionRegistry,
  type ContextAction,
  type ContextActionContext,
} from '../canvas/actions/index.js';
import type { CanvasEngine } from '../canvas/engine.js';
import './ContextMenu.css';

interface ContextMenuProps {
  engine: CanvasEngine | null;
  open: { x: number; y: number; targetId: string | null } | null;
  onClose: () => void;
}

const SECTION_ORDER: ContextAction['group'][] = [
  'common',
  'style',
  'content',
  'card',
  'table',
  'frame',
  'connector',
  'image',
  'drawing',
  'order',
  'align',
  'ai',
  'danger',
];

const SECTION_LABELS: Partial<Record<ContextAction['group'], string>> = {
  common: 'Geral',
  style: 'Estilo',
  content: 'Conteúdo',
  order: 'Camadas',
  align: 'Alinhamento',
  ai: 'IA',
  danger: '',
  card: 'Card',
  table: 'Tabela',
  frame: 'Frame',
  connector: 'Conector',
  image: 'Imagem',
  drawing: 'Desenho',
};

export function ContextMenu({ engine, open, onClose }: ContextMenuProps) {
  const { selectedIds, primarySelectionId, getElement, addElement, updateElement, removeElement, setSelectedIds, getElements, getChildren } =
    useBoardStore();
  const ref = useRef<HTMLDivElement>(null);

  const ctx: ContextActionContext | null = useMemo(() => {
    if (!engine || !open) return null;
    const ids = open.targetId ? [open.targetId] : selectedIds;
    const selection = ids
      .map((id) => getElement(id))
      .filter((el): el is NonNullable<typeof el> => Boolean(el));
    const primary = primarySelectionId ? getElement(primarySelectionId) : selection[0] ?? null;
    return {
      selection,
      primary,
      engine,
      store: { addElement, updateElement, removeElement, setSelectedIds, getElement, getElements, getChildren },
    };
  }, [engine, open, selectedIds, primarySelectionId, getElement, addElement, updateElement, removeElement, setSelectedIds, getElements, getChildren]);

  const resolved = useMemo(() => {
    if (!ctx) return null;
    return contextActionRegistry.resolveActions(ctx, 'context-menu');
  }, [ctx]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open || !resolved || !ctx) return null;

  // Adjust position to keep menu in viewport
  const menuW = 240;
  const menuH = 360;
  const left = Math.min(open.x, window.innerWidth - menuW - 8);
  const top = Math.min(open.y, window.innerHeight - menuH - 8);

  return (
    <div
      className="context-menu"
      ref={ref}
      style={{ position: 'fixed', left, top }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {SECTION_ORDER.map((group) => {
        const items = resolved.byGroup.get(group);
        if (!items || items.length === 0) return null;
        return (
          <div key={group} className="context-section">
            {SECTION_LABELS[group] ? (
              <div className="context-section-label">{SECTION_LABELS[group]}</div>
            ) : null}
            {items.map((action) => (
              <ContextMenuItem
                key={action.id}
                action={action}
                ctx={ctx}
                onClose={onClose}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ContextMenuItem({
  action,
  ctx,
  onClose,
}: {
  action: ContextAction;
  ctx: ContextActionContext;
  onClose: () => void;
}) {
  const Icon = action.icon;
  const hasChildren = Boolean(action.children);
  const toggled = action.isToggled?.(ctx);

  return (
    <div className={`context-item ${hasChildren ? 'has-children' : ''} ${action.group === 'danger' ? 'danger' : ''}`}>
      <button
        className="context-item-btn"
        onClick={(e) => {
          e.stopPropagation();
          if (!hasChildren && action.run) {
            action.run(ctx);
            onClose();
          }
        }}
      >
        <span className="context-item-icon">{Icon ? <Icon size={14} /> : null}</span>
        <span className="context-item-label">{action.label}</span>
        {toggled ? <span className="context-item-check">✓</span> : null}
        {action.shortcut ? <span className="context-item-shortcut">{action.shortcut}</span> : null}
        {hasChildren ? <span className="context-item-arrow">›</span> : null}
      </button>
      {hasChildren && (
        <div className="context-submenu">
          {action.children!(ctx).map((child) => (
            <ContextMenuItem key={child.id} action={child} ctx={ctx} onClose={onClose} />
          ))}
        </div>
      )}
    </div>
  );
}
