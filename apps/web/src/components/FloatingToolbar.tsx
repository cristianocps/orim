import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import { contextActionRegistry, type ContextAction, type ContextActionContext } from '../canvas/actions/index.js';
import { MoreHorizontal } from 'lucide-react';
import './FloatingToolbar.css';

interface FloatingToolbarProps {
  engine: CanvasEngine | null;
}

const PRIORITY_GROUPS: ContextAction['group'][] = [
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

export function FloatingToolbar({ engine }: FloatingToolbarProps) {
  const { selectedIds, primarySelectionId, getElement, addElement, updateElement, removeElement, setSelectedIds, getElements } =
    useBoardStore();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const [overflow, setOverflow] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const ctx: ContextActionContext | null = useMemo(() => {
    if (!engine) return null;
    const selection = selectedIds
      .map((id) => getElement(id))
      .filter((el): el is NonNullable<typeof el> => Boolean(el));
    const primary = primarySelectionId ? getElement(primarySelectionId) : selection[0] ?? null;
    return {
      selection,
      primary,
      engine,
      store: { addElement, updateElement, removeElement, setSelectedIds, getElement, getElements },
    };
  }, [engine, selectedIds, primarySelectionId, getElement, addElement, updateElement, removeElement, setSelectedIds, getElements]);

  const resolved = useMemo(() => {
    if (!ctx) return null;
    return contextActionRegistry.resolveActions(ctx, 'toolbar');
  }, [ctx]);

  // Compute grouped actions FIRST so we can decide whether to render at all
  // based on real content (not on whether the position has been resolved).
  // Gating the whole render on `position` was the source of the regression
  // where the toolbar wouldn't appear on left-click: if the very first
  // `getSelectionScreenRect()` happened to return a stale/null value the
  // toolbar would never paint, and only the right-click context-menu flow
  // (which doesn't depend on this) felt like it "still worked".
  const grouped: { group: ContextAction['group']; items: ContextAction[] }[] = [];
  if (resolved) {
    for (const group of PRIORITY_GROUPS) {
      const items = resolved.byGroup.get(group);
      if (items && items.length > 0) {
        grouped.push({ group, items });
      }
    }
  }

  const visible = Boolean(ctx && selectedIds.length > 0 && grouped.length > 0);

  // Position toolbar above selection bounding box, in coords RELATIVE TO
  // the .canvas-area parent. We compute the selection rect via the engine's
  // worldToScreen (which returns canvas-internal coords — i.e. relative to
  // the canvas-container's top-left), and rely on canvas-container filling
  // canvas-area, so the same coords work for `position: absolute` on the
  // toolbar (which is a sibling of canvas-container under canvas-area).
  //
  // We deliberately do NOT use viewport-relative `position: fixed` because
  // any ancestor with `transform`, `filter`, `perspective`, etc. would
  // re-anchor `fixed` to that ancestor instead of the viewport, producing
  // exactly the kind of "the toolbar appears but in the wrong place" bug
  // that's hard to reason about across browsers / future style changes.
  useLayoutEffect(() => {
    if (!engine || !visible) {
      setPosition(null);
      return;
    }
    let lastLeft = Number.NaN;
    let lastTop = Number.NaN;
    const computeLocalRect = () => {
      const ids = selectedIds;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const id of ids) {
        const b = engine.getElementBounds(id);
        if (!b) continue;
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      }
      if (minX === Infinity) return null;
      const tl = engine.worldToScreen({ x: minX, y: minY });
      const br = engine.worldToScreen({ x: maxX, y: maxY });
      return { left: tl.x, top: tl.y, width: br.x - tl.x, height: br.y - tl.y };
    };
    const tick = () => {
      const rect = computeLocalRect();
      if (!rect) return;
      const tbWidth = ref.current?.offsetWidth ?? 320;
      const tbHeight = ref.current?.offsetHeight ?? 44;
      const left = Math.max(8, rect.left + rect.width / 2 - tbWidth / 2);
      const top = Math.max(8, rect.top - tbHeight - 12);
      if (left !== lastLeft || top !== lastTop) {
        lastLeft = left;
        lastTop = top;
        setPosition({ left, top });
      }
    };
    // First measure may run before icons / the toolbar itself have a real
    // offsetWidth (HMR, slow first paint). Run twice: once now (for the
    // immediate positioning) and once on the next frame when the DOM is
    // guaranteed to be laid out.
    tick();
    const raf = requestAnimationFrame(tick);
    const i = window.setInterval(tick, 100);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(i);
    };
  }, [engine, visible, selectedIds, primarySelectionId]);

  if (!visible || !ctx) return null;

  const visibleGroups = grouped.slice(0, overflow ? grouped.length : 4);
  const overflowGroups = grouped.slice(visibleGroups.length);

  // Render even when position is null — we just hide it via visibility so
  // the ref is populated and useLayoutEffect can measure it for the next
  // tick. Once tick() resolves a position we flip visibility on. This
  // prevents the "toolbar never shows" race we saw on left-click.
  const style: React.CSSProperties = position
    ? { position: 'absolute', left: position.left, top: position.top, transform: 'none' }
    : { position: 'absolute', left: -9999, top: -9999, visibility: 'hidden' };

  return (
    <div
      className="floating-toolbar"
      ref={ref}
      style={style}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {visibleGroups.map(({ group, items }, gi) => (
        <div className="float-group" key={group}>
          {gi > 0 && <div className="float-sep" />}
          {items.map((action) => (
            <ToolbarButton
              key={action.id}
              action={action}
              ctx={ctx}
              isOpen={openMenuId === action.id}
              setOpen={(open) => setOpenMenuId(open ? action.id : null)}
              closeAll={() => setOpenMenuId(null)}
            />
          ))}
        </div>
      ))}
      {overflowGroups.length > 0 && (
        <button
          className="float-btn"
          title="Mais ações"
          onClick={() => setOverflow((o) => !o)}
        >
          <MoreHorizontal size={16} />
        </button>
      )}
    </div>
  );
}

function ToolbarButton({
  action,
  ctx,
  isOpen,
  setOpen,
  closeAll,
}: {
  action: ContextAction;
  ctx: ContextActionContext;
  isOpen: boolean;
  setOpen: (open: boolean) => void;
  closeAll: () => void;
}) {
  const Icon = action.icon;
  const toggled = action.isToggled?.(ctx) ?? false;
  const hasChildren = Boolean(action.children);

  if (action.renderInToolbar) {
    const Custom = action.renderInToolbar;
    return <Custom ctx={ctx} />;
  }

  return (
    <div className={`float-btn-wrap ${isOpen ? 'open' : ''}`}>
      <button
        className={`float-btn ${toggled ? 'toggled' : ''} ${action.group === 'danger' ? 'danger' : ''}`}
        title={action.shortcut ? `${action.label} (${action.shortcut})` : action.label}
        onClick={(e) => {
          e.stopPropagation();
          if (hasChildren) {
            setOpen(!isOpen);
          } else if (action.run) {
            action.run(ctx);
            closeAll();
          }
        }}
      >
        {Icon ? <Icon size={16} /> : <span style={{ fontSize: 11 }}>{action.label.slice(0, 2)}</span>}
      </button>
      {hasChildren && isOpen && (
        <div className="float-submenu" onMouseDown={(e) => e.stopPropagation()}>
          {action.children!(ctx).map((child) => (
            <button
              key={child.id}
              className={`float-submenu-item ${child.isToggled?.(ctx) ? 'toggled' : ''}`}
              onClick={() => {
                child.run?.(ctx);
                closeAll();
              }}
            >
              {child.icon ? <child.icon size={14} /> : null}
              <span>{child.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
