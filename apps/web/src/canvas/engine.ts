import {
  Application,
  Container,
  Graphics,
  Rectangle,
  FederatedPointerEvent,
  Point as PixiPoint,
} from 'pixi.js';
import type {
  CanvasElement,
  Point,
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorAnchorId,
} from '@orim/shared';
import { uuidv4 } from './uuid.js';
import {
  createConnectorContainer,
  findNearestAnchor,
  getAnchorDescriptors,
  getAnchorPoint,
  elementToConnectorEndpoint,
  type AnchorDescriptor,
} from './connectors.js';
import {
  rendererRegistry,
  registerBuiltinRenderers,
  type ElementRenderer,
} from './renderers/index.js';
import type { InlineEditorDescriptor } from './renderers/types.js';

export interface SelectionInfo {
  ids: string[];
  primaryId: string | null;
}

export interface HoverInfo {
  id: string | null;
  bounds?: { x: number; y: number; width: number; height: number };
  anchors?: AnchorDescriptor[];
  locked?: boolean;
}

export interface InlineEditRequest {
  id: string;
  field: 'text' | 'title' | 'description';
  multiline: boolean;
  bounds: { x: number; y: number; width: number; height: number };
  fontSize: number;
  initialValue: string;
}

export interface ConnectorDragInfo {
  fromId?: string;
  fromAnchor?: ConnectorAnchorId;
  fromPoint: Point;
  toPoint: Point;
  hoveredTargetId: string | null;
  hoveredAnchor: ConnectorAnchorId | null;
}

export interface ContextMenuRequest {
  screenX: number;
  screenY: number;
  worldPoint: Point;
  targetId: string | null;
}

export type AlignMode = 'left' | 'right' | 'center-h' | 'top' | 'bottom' | 'center-v';
export type DistributeMode = 'horizontal' | 'vertical';
export type OrderMode = 'front' | 'back' | 'forward' | 'backward';

export interface CanvasEngine {
  app: Application;
  world: Container;
  ready: Promise<void>;
  createElement(el: CanvasElement, options?: { skipEmit?: boolean }): void;
  updateElement(id: string, patch: Partial<CanvasElement>, options?: { skipEmit?: boolean }): void;
  deleteElement(id: string, options?: { skipEmit?: boolean }): void;
  addRandomShape(type: string): CanvasElement | null;
  insertElementAt(type: string, point?: Point, overrides?: Partial<CanvasElement>): CanvasElement | null;
  duplicateElement(id: string): CanvasElement | null;
  setLocked(id: string, locked: boolean): void;
  setSelection(ids: string[]): void;
  getSelection(): SelectionInfo;
  getElement(id: string): CanvasElement | null;
  getElements(): CanvasElement[];
  getElementBounds(id: string): { x: number; y: number; width: number; height: number } | null;
  getElementScreenRect(id: string): DOMRect | null;
  getSelectionScreenRect(): DOMRect | null;
  getViewport(): { x: number; y: number; zoom: number };
  setViewport(x: number, y: number, zoom: number): void;
  screenToWorld(point: Point): Point;
  worldToScreen(point: Point): Point;
  toggleSnapToGrid(enabled: boolean): void;
  getSnapToGrid(): boolean;
  startConnectorMode(): void;
  endConnectorMode(): void;
  startConnectorFrom(elementId: string, anchorId: ConnectorAnchorId, screenPoint: Point): void;
  computeNearestAnchor(elementId: string, worldPoint: Point): ConnectorAnchorId | null;
  startDrawingMode(options: { color: number; width: number; mode: 'pen' | 'highlighter' | 'eraser' }): void;
  endDrawingMode(): void;
  beginInlineEdit(id: string): void;
  endInlineEdit(commit?: boolean, value?: string): void;
  bringToFront(id: string): void;
  sendToBack(id: string): void;
  bringForward(id: string): void;
  sendBackward(id: string): void;
  alignSelection(mode: AlignMode): void;
  distributeSelection(mode: DistributeMode): void;
  groupSelection(): string | null;
  ungroupSelection(): void;
  registerRenderer(type: string, renderer: ElementRenderer): void;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
  destroy(): void;
}

type EventMap = Record<string, ((...args: any[]) => void)[]>;

const GRID_SIZE = 50;
const GRID_COLOR = 0xcbd5e1;
const GRID_COLOR_MAJOR = 0x94a3b8;
const SELECTION_COLOR = 0x3b82f6;
const ALIGN_THRESHOLD = 8;

const HANDLE_SIZE = 10;
const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
type ResizeHandle = (typeof RESIZE_HANDLES)[number];

interface ResizeState {
  id: string;
  handle: ResizeHandle;
  startBounds: { x: number; y: number; width: number; height: number };
  startTransform: CanvasElement['transform'];
  startSize?: { width: number; height: number };
  startRadius?: number;
}

export function initCanvasEngine(container: HTMLDivElement): CanvasEngine {
  const app = new Application();
  const world = new Container();
  const gridContainer = new Container();
  const elementsContainer = new Container();
  const uiContainer = new Container();
  const selectionContainer = new Container();
  const hoverContainer = new Container();
  const guidesContainer = new Container();
  const handlesContainer = new Container();
  const connectorsContainer = new Container();

  world.addChild(gridContainer);
  world.addChild(elementsContainer);
  world.addChild(connectorsContainer);
  world.addChild(uiContainer);
  uiContainer.addChild(selectionContainer);
  uiContainer.addChild(guidesContainer);
  uiContainer.addChild(hoverContainer);
  uiContainer.addChild(handlesContainer);

  const events: EventMap = {};
  const emit = (event: string, ...args: any[]) => {
    events[event]?.forEach((h) => h(...args));
  };

  let viewport = { x: 0, y: 0, zoom: 1 };
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let viewportStart = { x: 0, y: 0 };

  let isSelecting = false;
  let selectStart = { x: 0, y: 0 };
  let selectionBox: Graphics | null = null;
  const selectedIds = new Set<string>();
  let primarySelectionId: string | null = null;

  let snapToGrid = false;
  const showGuides = true;

  // Drawing mode
  let drawingMode = false;
  let drawingOptions = { color: 0x1e293b, width: 2, mode: 'pen' as 'pen' | 'highlighter' | 'eraser' };
  let currentStroke: { x: number; y: number }[] = [];
  let drawingPreview: Graphics | null = null;

  // Connector creation mode (drag-to-connect)
  let connectorMode = false;
  let connectorDrag: {
    fromId?: string;
    fromAnchor?: ConnectorAnchorId;
    fromPoint: Point;
    preview: Graphics;
    hoveredTargetId: string | null;
    hoveredAnchor: ConnectorAnchorId | null;
  } | null = null;

  // Hover state
  let hoveredId: string | null = null;
  let hoverHandlesVisible = false;

  // Resize state
  let resizing: ResizeState | null = null;

  // Inline edit
  let editingId: string | null = null;

  // Drag state
  let dragSession: {
    primaryId: string;
    startPositions: Map<string, { x: number; y: number }>;
    pointerStart: Point;
    moved: boolean;
  } | null = null;

  // Element model: source of truth lives outside the engine but engine keeps a cache
  // for fast access during interactions. The cache is updated through createElement / updateElement.
  const elementModels = new Map<string, CanvasElement>();
  const elementMap = new Map<string, Container>();
  const connectorsMap = new Map<string, Container>();

  function isLocked(id: string): boolean {
    const el = elementModels.get(id);
    return Boolean(el?.metadata?.locked);
  }

  function localBoundsToWorld(c: Container): { x: number; y: number; width: number; height: number } {
    const bounds = c.getBounds();
    const tl = world.toLocal({ x: bounds.x, y: bounds.y });
    const br = world.toLocal({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
    return { x: tl.x, y: tl.y, width: br.x - tl.x, height: br.y - tl.y };
  }

  function refreshConnectors() {
    connectorsMap.forEach((c) => {
      const fn = (c as any).__updateConnector;
      if (fn) fn();
    });
  }

  function drawGrid() {
    if (!app?.screen) return;
    destroyChildren(gridContainer);
    const g = new Graphics();
    const bounds = app.screen;
    const scale = viewport.zoom;
    // Visible world range, given that screenToWorld((cx, cy)) === (vp.x, vp.y):
    //   X: [vp.x - cx/zoom, vp.x + cx/zoom]
    //   Y: [vp.y - cy/zoom, vp.y + cy/zoom]
    const startX = Math.floor((viewport.x - bounds.width / 2 / scale) / GRID_SIZE) * GRID_SIZE;
    const endX = Math.ceil((viewport.x + bounds.width / 2 / scale) / GRID_SIZE) * GRID_SIZE;
    const startY = Math.floor((viewport.y - bounds.height / 2 / scale) / GRID_SIZE) * GRID_SIZE;
    const endY = Math.ceil((viewport.y + bounds.height / 2 / scale) / GRID_SIZE) * GRID_SIZE;

    for (let x = startX; x <= endX; x += GRID_SIZE) {
      const isMajor = Math.abs(x) % (GRID_SIZE * 5) === 0;
      g.moveTo(x, startY);
      g.lineTo(x, endY);
      g.stroke({ width: isMajor ? 1.2 : 0.6, color: isMajor ? GRID_COLOR_MAJOR : GRID_COLOR, alpha: 0.4 });
    }
    for (let y = startY; y <= endY; y += GRID_SIZE) {
      const isMajor = Math.abs(y) % (GRID_SIZE * 5) === 0;
      g.moveTo(startX, y);
      g.lineTo(endX, y);
      g.stroke({ width: isMajor ? 1.2 : 0.6, color: isMajor ? GRID_COLOR_MAJOR : GRID_COLOR, alpha: 0.4 });
    }
    gridContainer.addChild(g);
  }

  function updateWorldTransform() {
    if (!app?.screen) return;
    const cx = app.screen.width / 2;
    const cy = app.screen.height / 2;
    world.position.set(cx, cy);
    world.scale.set(viewport.zoom);
    // Pivot is the world-local point that gets anchored to `position`. We
    // want world coord (viewport.x, viewport.y) to render at screen center
    // (cx, cy), so pivot MUST be (viewport.x, viewport.y) — NOT the negated
    // value. With the wrong sign, Pixi rendered everything offset by
    // 2*viewport from where `screenToWorld` placed it, which made hit-tests
    // (selection, connector anchor snap, drag pickup) wildly inconsistent
    // with the cursor as soon as the user panned or zoomed (with vp=0,0
    // both signs give pivot=0,0 so the bug stayed hidden).
    world.pivot.set(viewport.x, viewport.y);
    drawGrid();
    renderHover();
  }

  function clearGuides() {
    destroyChildren(guidesContainer);
  }

  function renderSelection() {
    destroyChildren(selectionContainer);
    destroyChildren(handlesContainer);

    const g = new Graphics();
    selectedIds.forEach((id) => {
      const el = elementMap.get(id);
      if (!el) return;
      const b = localBoundsToWorld(el);
      const locked = isLocked(id);
      g.rect(b.x - 2, b.y - 2, b.width + 4, b.height + 4);
      g.stroke({
        width: 2,
        color: locked ? 0xf59e0b : SELECTION_COLOR,
        alpha: 1,
      });
    });
    selectionContainer.addChild(g);

    const focusId = primarySelectionId ?? (selectedIds.size === 1 ? Array.from(selectedIds)[0] : null);
    if (focusId) {
      const focus = elementModels.get(focusId);
      if (focus?.type === 'connector') {
        drawConnectorEndpointHandles(focusId);
      } else {
        drawResizeHandles(focusId);
      }
    }
  }

  function drawConnectorEndpointHandles(connectorId: string) {
    const conn = elementModels.get(connectorId) as ConnectorElement | undefined;
    if (!conn) return;
    const fromEndpoint = elementToConnectorEndpoint(conn, 'from');
    const toEndpoint = elementToConnectorEndpoint(conn, 'to');
    [
      { side: 'from' as const, endpoint: fromEndpoint },
      { side: 'to' as const, endpoint: toEndpoint },
    ].forEach(({ side, endpoint }) => {
      if (!endpoint) return;
      let pt: Point;
      if (endpoint.kind === 'point') {
        pt = { x: endpoint.x, y: endpoint.y };
      } else {
        const c = elementMap.get(endpoint.elementId);
        if (!c) return;
        const global = c.toGlobal(getAnchorPoint(c, endpoint.anchorId));
        const local = world.toLocal(global);
        pt = { x: local.x, y: local.y };
      }
      const h = new Graphics();
      const r = 6 / viewport.zoom;
      h.circle(pt.x, pt.y, r);
      h.fill({ color: 0xffffff });
      h.stroke({ width: 2 / viewport.zoom, color: SELECTION_COLOR });
      h.eventMode = 'static';
      h.cursor = 'grab';
      (h as any).__connectorEndpoint = { connectorId, side };
      h.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        startConnectorEndpointDrag(connectorId, side, e);
      });
      handlesContainer.addChild(h);
    });
  }

  function startConnectorEndpointDrag(connectorId: string, side: 'from' | 'to', e: FederatedPointerEvent) {
    const conn = elementModels.get(connectorId) as ConnectorElement | undefined;
    if (!conn) return;
    const screen = { x: e.global.x, y: e.global.y };
    const otherSide = side === 'from' ? 'to' : 'from';
    const otherEp = elementToConnectorEndpoint(conn, otherSide);
    if (!otherEp) return;
    let otherWorld: Point;
    if (otherEp.kind === 'point') otherWorld = { x: otherEp.x, y: otherEp.y };
    else {
      const c = elementMap.get(otherEp.elementId);
      if (!c) return;
      const global = c.toGlobal(getAnchorPoint(c, otherEp.anchorId));
      const w = world.toLocal(global);
      otherWorld = { x: w.x, y: w.y };
    }
    // Use connector drag visualization, but on completion we update the existing connector
    startConnectorDragFromPoint(otherWorld, otherEp.kind === 'element' ? otherEp.elementId : undefined, otherEp.kind === 'element' ? otherEp.anchorId : undefined);
    if (connectorDrag) {
      (connectorDrag as any).__editingConnectorId = connectorId;
      (connectorDrag as any).__editingSide = side;
    }
    void screen;
  }

  function drawResizeHandles(id: string) {
    if (isLocked(id)) return;
    const el = elementMap.get(id);
    if (!el) return;
    const b = localBoundsToWorld(el);
    const handles = handlePositions(b);
    handles.forEach(({ pos, handle }) => {
      const h = new Graphics();
      const half = HANDLE_SIZE / 2 / viewport.zoom;
      h.rect(pos.x - half, pos.y - half, HANDLE_SIZE / viewport.zoom, HANDLE_SIZE / viewport.zoom);
      h.fill({ color: 0xffffff });
      h.stroke({ width: 1.5 / viewport.zoom, color: SELECTION_COLOR });
      h.eventMode = 'static';
      h.cursor = handleCursor(handle);
      (h as any).__handleId = handle;
      (h as any).__elementId = id;
      h.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        startResize(id, handle, e);
      });
      handlesContainer.addChild(h);
    });
  }

  function handlePositions(
    b: { x: number; y: number; width: number; height: number },
  ): { pos: Point; handle: ResizeHandle }[] {
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    return [
      { pos: { x: b.x, y: b.y }, handle: 'nw' },
      { pos: { x: cx, y: b.y }, handle: 'n' },
      { pos: { x: b.x + b.width, y: b.y }, handle: 'ne' },
      { pos: { x: b.x + b.width, y: cy }, handle: 'e' },
      { pos: { x: b.x + b.width, y: b.y + b.height }, handle: 'se' },
      { pos: { x: cx, y: b.y + b.height }, handle: 's' },
      { pos: { x: b.x, y: b.y + b.height }, handle: 'sw' },
      { pos: { x: b.x, y: cy }, handle: 'w' },
    ];
  }

  function handleCursor(h: ResizeHandle): string {
    return {
      n: 'ns-resize',
      s: 'ns-resize',
      e: 'ew-resize',
      w: 'ew-resize',
      nw: 'nwse-resize',
      se: 'nwse-resize',
      ne: 'nesw-resize',
      sw: 'nesw-resize',
    }[h];
  }

  function renderHover() {
    destroyChildren(hoverContainer);
    if (!hoverHandlesVisible || !hoveredId) return;
    const c = elementMap.get(hoveredId);
    if (!c) return;
    if (isLocked(hoveredId)) return;

    const b = localBoundsToWorld(c);

    // Subtle hover outline
    const outline = new Graphics();
    outline.rect(b.x - 1, b.y - 1, b.width + 2, b.height + 2);
    outline.stroke({ width: 1.5 / viewport.zoom, color: 0x60a5fa, alpha: 0.6 });
    hoverContainer.addChild(outline);

    if (selectedIds.has(hoveredId)) return;

    // External connection handles (hidden during connector drag)
    if (connectorMode || connectorDrag) return;

    const offset = 18 / viewport.zoom;
    const radius = 6 / viewport.zoom;
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    const handles = [
      { x: cx, y: b.y - offset, anchor: 'top' as ConnectorAnchorId },
      { x: b.x + b.width + offset, y: cy, anchor: 'right' as ConnectorAnchorId },
      { x: cx, y: b.y + b.height + offset, anchor: 'bottom' as ConnectorAnchorId },
      { x: b.x - offset, y: cy, anchor: 'left' as ConnectorAnchorId },
    ];
    const targetId = hoveredId;
    handles.forEach(({ x, y, anchor }) => {
      // Slightly larger invisible hit area to make hovering forgiving.
      const hit = new Graphics();
      hit.circle(x, y, radius * 2);
      hit.fill({ color: 0xffffff, alpha: 0.001 });
      hit.eventMode = 'static';
      hit.cursor = 'crosshair';
      (hit as any).__connectionAnchor = { id: targetId, anchor };
      // Visible disc on top
      const handle = new Graphics();
      handle.circle(x, y, radius);
      handle.fill({ color: 0xffffff });
      handle.stroke({ width: 1.5 / viewport.zoom, color: SELECTION_COLOR });
      handle.eventMode = 'none';
      hit.on('pointerover', () => {
        cancelHoverClear();
      });
      hit.on('pointerout', () => {
        // Schedule a clear; if user lands back on the element or another
        // handle, the next pointerover cancels it.
        setHovered(null);
      });
      hit.on('pointerdown', (e: FederatedPointerEvent) => {
        e.stopPropagation();
        cancelHoverClear();
        const screen = { x: e.global.x, y: e.global.y };
        engine.startConnectorFrom(targetId!, anchor, screen);
      });
      hoverContainer.addChild(hit);
      hoverContainer.addChild(handle);
    });
  }

  let hoverClearTimer: ReturnType<typeof setTimeout> | null = null;

  function cancelHoverClear() {
    if (hoverClearTimer) {
      clearTimeout(hoverClearTimer);
      hoverClearTimer = null;
    }
  }

  function setHovered(id: string | null) {
    cancelHoverClear();
    if (id === null) {
      // Defer clearing so the pointer can move from element edge onto an
      // external connection handle without losing the hover state.
      hoverClearTimer = setTimeout(() => {
        hoverClearTimer = null;
        hoveredId = null;
        hoverHandlesVisible = false;
        renderHover();
        emit('hoverChange', { id: null, locked: false });
      }, 180);
      return;
    }
    if (hoveredId === id) return;
    hoveredId = id;
    hoverHandlesVisible = true;
    renderHover();
    emit('hoverChange', { id, locked: isLocked(id) });
  }

  function snapToGridValue(v: number): number {
    if (!snapToGrid) return v;
    return Math.round(v / GRID_SIZE) * GRID_SIZE;
  }

  function setupContainerInteractions(container: Container, el: CanvasElement) {
    container.eventMode = 'static';
    container.cursor = 'pointer';

    container.on('pointerover', () => {
      if (resizing || drawingMode) return;
      setHovered(el.id);
    });
    container.on('pointerout', () => {
      if (hoveredId === el.id) setHovered(null);
    });

    container.on('pointerdown', (e: FederatedPointerEvent) => {
      if (drawingMode) return;
      if (e.button === 2) {
        // Right click: select the element (if not already in selection) so
        // the floating toolbar / properties panel reflect the same target the
        // context menu acts on, then emit the contextMenu request.
        e.stopPropagation();
        if (!selectedIds.has(el.id)) {
          selectedIds.clear();
          selectedIds.add(el.id);
          primarySelectionId = el.id;
          emitSelection();
          renderSelection();
        }
        emit('contextMenu', {
          screenX: e.global.x,
          screenY: e.global.y,
          worldPoint: screenToWorld({ x: e.global.x, y: e.global.y }),
          targetId: el.id,
        } as ContextMenuRequest);
        return;
      }
      e.stopPropagation();

      // Connector mode — clicking element creates anchored connector
      if (connectorMode) {
        const worldPos = screenToWorld({ x: e.global.x, y: e.global.y });
        const { anchor } = findNearestAnchor(container, worldPos);
        engine.startConnectorFrom(el.id, anchor, { x: e.global.x, y: e.global.y });
        return;
      }

      const isLockedEl = isLocked(el.id);

      // Select
      if (e.shiftKey) {
        if (selectedIds.has(el.id)) {
          selectedIds.delete(el.id);
          if (primarySelectionId === el.id) primarySelectionId = null;
        } else {
          selectedIds.add(el.id);
          primarySelectionId = el.id;
        }
      } else {
        if (!selectedIds.has(el.id)) {
          selectedIds.clear();
          selectedIds.add(el.id);
        }
        primarySelectionId = el.id;
      }
      emitSelection();
      renderSelection();

      if (isLockedEl) return;

      const worldPos = screenToWorld({ x: e.global.x, y: e.global.y });
      const startPositions = new Map<string, { x: number; y: number }>();
      selectedIds.forEach((sid) => {
        const c = elementMap.get(sid);
        if (c && !isLocked(sid)) startPositions.set(sid, { x: c.x, y: c.y });
      });
      dragSession = {
        primaryId: el.id,
        startPositions,
        pointerStart: worldPos,
        moved: false,
      };
    });

    container.on('pointerdblclick', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (isLocked(el.id)) return;
      const editor = (container as any).__inlineEditor as InlineEditorDescriptor | undefined;
      if (editor) engine.beginInlineEdit(el.id);
    });
  }

  function emitSelection() {
    const ids = Array.from(selectedIds);
    if (primarySelectionId && !selectedIds.has(primarySelectionId)) {
      primarySelectionId = ids[ids.length - 1] ?? null;
    }
    if (!primarySelectionId && ids.length > 0) primarySelectionId = ids[ids.length - 1];
    emit('selectionChange', { ids, primaryId: primarySelectionId } as SelectionInfo);
  }

  function startResize(id: string, handle: ResizeHandle, e: FederatedPointerEvent) {
    if (isLocked(id)) return;
    const c = elementMap.get(id);
    const el = elementModels.get(id);
    if (!c || !el) return;
    const bounds = localBoundsToWorld(c);
    resizing = {
      id,
      handle,
      startBounds: bounds,
      startTransform: { ...el.transform },
      startSize: (el as any).size ? { ...(el as any).size } : undefined,
      startRadius: (el as any).radius,
    };
    app.stage.cursor = handleCursor(handle);
    (resizing as any).pointerStart = screenToWorld({ x: e.global.x, y: e.global.y });
  }

  function applyResize(worldPos: Point) {
    if (!resizing) return;
    const { id, handle, startBounds, startTransform } = resizing;
    const pStart = (resizing as any).pointerStart as Point;
    const dx = worldPos.x - pStart.x;
    const dy = worldPos.y - pStart.y;

    let newW = startBounds.width;
    let newH = startBounds.height;
    let newX = startTransform.x;
    let newY = startTransform.y;

    const minW = 30;
    const minH = 30;

    if (handle.includes('e')) newW = Math.max(minW, startBounds.width + dx);
    if (handle.includes('w')) {
      newW = Math.max(minW, startBounds.width - dx);
      newX = startTransform.x + (startBounds.width - newW) / 2 + dx / 2;
    }
    if (handle.includes('s')) newH = Math.max(minH, startBounds.height + dy);
    if (handle.includes('n')) {
      newH = Math.max(minH, startBounds.height - dy);
      newY = startTransform.y + (startBounds.height - newH) / 2 + dy / 2;
    }
    if (handle === 'e' || handle === 'w') {
      // Horizontal only — don't change y
      newY = startTransform.y;
    }
    if (handle === 'n' || handle === 's') {
      newX = startTransform.x;
    }

    // For e/w handles we want the position to shift by half delta to keep the opposite side anchored
    if (handle === 'e') {
      newX = startTransform.x + dx / 2;
    }
    if (handle === 'w') {
      newX = startTransform.x + dx / 2;
    }
    if (handle === 's') {
      newY = startTransform.y + dy / 2;
    }
    if (handle === 'n') {
      newY = startTransform.y + dy / 2;
    }

    const el = elementModels.get(id);
    if (!el) return;
    const patch: Partial<CanvasElement> = {
      transform: { ...el.transform, x: newX, y: newY },
    };
    if ((el as any).size) {
      (patch as any).size = { width: newW, height: newH };
    } else if ((el as any).radius !== undefined) {
      (patch as any).radius = Math.max(15, Math.min(newW, newH) / 2);
    }
    engine.updateElement(id, patch, { skipEmit: true });
  }

  function endResize() {
    if (!resizing) return;
    const id = resizing.id;
    const el = elementModels.get(id);
    if (el) {
      // Final emit so sync persists the new size
      const finalPatch: Partial<CanvasElement> = { transform: { ...el.transform } };
      if ((el as any).size) (finalPatch as any).size = { ...(el as any).size };
      if ((el as any).radius !== undefined) (finalPatch as any).radius = (el as any).radius;
      emit('element.updated', { id, patch: finalPatch });
    }
    resizing = null;
    app.stage.cursor = 'default';
    renderSelection();
  }

  function getScreenSize(): { width: number; height: number } {
    if (!app?.screen) {
      const rect = container.getBoundingClientRect();
      return { width: rect.width || 1, height: rect.height || 1 };
    }
    return { width: app.screen.width, height: app.screen.height };
  }

  function screenToWorld(point: Point): Point {
    const screen = getScreenSize();
    const cx = screen.width / 2;
    const cy = screen.height / 2;
    return {
      x: (point.x - cx) / viewport.zoom + viewport.x,
      y: (point.y - cy) / viewport.zoom + viewport.y,
    };
  }

  function worldToScreen(point: Point): Point {
    const screen = getScreenSize();
    const cx = screen.width / 2;
    const cy = screen.height / 2;
    return {
      x: (point.x - viewport.x) * viewport.zoom + cx,
      y: (point.y - viewport.y) * viewport.zoom + cy,
    };
  }

  function startConnectorDragFromPoint(
    fromPoint: Point,
    fromId?: string,
    fromAnchor?: ConnectorAnchorId,
  ) {
    const preview = new Graphics();
    uiContainer.addChild(preview);
    connectorDrag = {
      fromId,
      fromAnchor,
      fromPoint,
      preview,
      hoveredTargetId: null,
      hoveredAnchor: null,
    };
    app.stage.cursor = 'crosshair';
  }

  function endConnectorDrag(targetId: string | null, anchor: ConnectorAnchorId | null, dropPoint: Point) {
    if (!connectorDrag) return;
    const { fromId, fromAnchor, fromPoint, preview } = connectorDrag;
    const editingConnectorId = (connectorDrag as any).__editingConnectorId as string | undefined;
    const editingSide = (connectorDrag as any).__editingSide as 'from' | 'to' | undefined;
    preview.destroy();
    app.stage.cursor = 'default';
    connectorDrag = null;
    connectorMode = false;

    const newEndpoint: ConnectorEndpoint = targetId && anchor
      ? { kind: 'element', elementId: targetId, anchorId: anchor }
      : { kind: 'point', x: dropPoint.x, y: dropPoint.y };

    if (editingConnectorId && editingSide) {
      const patch: Partial<ConnectorElement> = { [editingSide]: newEndpoint } as any;
      engine.updateElement(editingConnectorId, patch as Partial<CanvasElement>);
      return;
    }

    if (!fromId) return;
    const fromEndpoint: ConnectorEndpoint = fromAnchor
      ? { kind: 'element', elementId: fromId, anchorId: fromAnchor }
      : { kind: 'point', x: fromPoint.x, y: fromPoint.y };

    if (newEndpoint.kind === 'point' && fromEndpoint.kind === 'point') return;

    const me = elementModels.get(fromId);
    const id = uuidv4();
    const connectorEl: ConnectorElement = {
      id,
      type: 'connector',
      from: fromEndpoint,
      to: newEndpoint,
      styleType: 'curved',
      arrowEnd: 'triangle',
      arrowStart: 'none',
      lineStyle: 'solid',
      strokeColor: 0x475569,
      strokeWidth: 2,
      transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      style: {},
      metadata: {},
      createdBy: me?.createdBy ?? 'local-user',
      updatedAt: new Date().toISOString(),
    };
    engine.createElement(connectorEl);

    selectedIds.clear();
    selectedIds.add(id);
    primarySelectionId = id;
    emitSelection();
    renderSelection();

    if (newEndpoint.kind === 'point') {
      emit('connectorOpenEnd', { connectorId: id, screenPoint: worldToScreen(dropPoint) });
    }
  }

  function getElementAtScreenPoint(point: Point): { id: string; anchor: ConnectorAnchorId } | null {
    const worldPos = screenToWorld(point);
    // Iterate top-down (reverse z-order) so the topmost element wins on
    // overlap. Previously we iterated `elementMap` in insertion order and
    // let the LAST match win, which breaks after `bringToFront`/`sendToBack`
    // or any structural rebuild — the element-on-top visually was no longer
    // the one returned, and connectors got attached to whatever happened to
    // be later in insertion order. Going through `elementsContainer.children`
    // mirrors the actual paint order.
    const children = elementsContainer.children;
    for (let i = children.length - 1; i >= 0; i--) {
      const c = children[i] as Container;
      const id = (c as any).__elementId as string | undefined;
      if (!id) continue;
      const b = localBoundsToWorld(c);
      if (
        worldPos.x >= b.x &&
        worldPos.x <= b.x + b.width &&
        worldPos.y >= b.y &&
        worldPos.y <= b.y + b.height
      ) {
        const { anchor } = findNearestAnchor(c, worldPos);
        return { id, anchor };
      }
    }
    return null;
  }

  function onPointerDown(e: FederatedPointerEvent) {
    if (drawingMode && e.button === 0) {
      const worldPos = screenToWorld({ x: e.global.x, y: e.global.y });
      currentStroke = [{ x: worldPos.x, y: worldPos.y }];
      drawingPreview = new Graphics();
      uiContainer.addChild(drawingPreview);
      return;
    }
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning = true;
      panStart = { x: e.global.x, y: e.global.y };
      viewportStart = { ...viewport };
      app.stage.cursor = 'grabbing';
      return;
    }
    if (e.button === 2) {
      e.stopPropagation();
      emit('contextMenu', {
        screenX: e.global.x,
        screenY: e.global.y,
        worldPoint: screenToWorld({ x: e.global.x, y: e.global.y }),
        targetId: null,
      } as ContextMenuRequest);
      return;
    }
    if (e.target === app.stage) {
      if (!e.shiftKey) {
        selectedIds.clear();
        primarySelectionId = null;
        emitSelection();
        renderSelection();
      }
      isSelecting = true;
      selectStart = screenToWorld({ x: e.global.x, y: e.global.y });
      selectionBox = new Graphics();
      uiContainer.addChild(selectionBox);
    }
  }

  function onPointerMove(e: FederatedPointerEvent) {
    const worldPos = screenToWorld({ x: e.global.x, y: e.global.y });

    if (resizing) {
      applyResize(worldPos);
      refreshConnectors();
      return;
    }

    if (connectorDrag) {
      const { preview, fromPoint } = connectorDrag;
      const local = uiContainer.toLocal({ x: e.global.x, y: e.global.y } as PixiPoint);
      const localFrom = uiContainer.toLocal(worldToScreen(fromPoint) as PixiPoint);
      preview.clear();
      preview.moveTo(localFrom.x, localFrom.y);
      const midX = (localFrom.x + local.x) / 2;
      preview.bezierCurveTo(midX, localFrom.y, midX, local.y, local.x, local.y);
      preview.stroke({ width: 2, color: 0x3b82f6, alpha: 0.7 });
      const found = getElementAtScreenPoint({ x: e.global.x, y: e.global.y });
      connectorDrag.hoveredTargetId = found && found.id !== connectorDrag.fromId ? found.id : null;
      connectorDrag.hoveredAnchor = found && found.id !== connectorDrag.fromId ? found.anchor : null;
      // Highlight target
      destroyChildren(hoverContainer);
      if (connectorDrag.hoveredTargetId) {
        const c = elementMap.get(connectorDrag.hoveredTargetId);
        if (c) {
          const b = localBoundsToWorld(c);
          const hl = new Graphics();
          hl.rect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
          hl.stroke({ width: 2 / viewport.zoom, color: 0x10b981 });
          hoverContainer.addChild(hl);
        }
      }
      return;
    }

    if (drawingMode && currentStroke.length > 0 && drawingPreview) {
      currentStroke.push({ x: worldPos.x, y: worldPos.y });
      drawingPreview.clear();
      const alpha = drawingOptions.mode === 'highlighter' ? 0.3 : 1;
      const width = drawingOptions.mode === 'highlighter' ? drawingOptions.width * 3 : drawingOptions.width;
      drawingPreview.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        drawingPreview.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      drawingPreview.stroke({ width, color: drawingOptions.color, alpha });
      return;
    }

    if (isPanning) {
      const dx = (e.global.x - panStart.x) / viewport.zoom;
      const dy = (e.global.y - panStart.y) / viewport.zoom;
      viewport.x = viewportStart.x - dx;
      viewport.y = viewportStart.y - dy;
      updateWorldTransform();
      renderSelection();
      return;
    }

    if (dragSession) {
      const dx = worldPos.x - dragSession.pointerStart.x;
      const dy = worldPos.y - dragSession.pointerStart.y;
      if (!dragSession.moved && (Math.abs(dx) > 1 || Math.abs(dy) > 1)) {
        dragSession.moved = true;
        // Drag actually started — hide hover handles so they don't leave a
        // "ghost" with the connection points at the original position.
        cancelHoverClear();
        hoverHandlesVisible = false;
        destroyChildren(hoverContainer);
      }
      dragSession.startPositions.forEach((start, id) => {
        const c = elementMap.get(id);
        if (!c) return;
        let newX = start.x + dx;
        let newY = start.y + dy;
        if (snapToGrid) {
          newX = snapToGridValue(newX);
          newY = snapToGridValue(newY);
        }
        c.position.set(newX, newY);
        const el = elementModels.get(id);
        if (el) {
          el.transform = { ...el.transform, x: newX, y: newY };
        }
        if (id === dragSession!.primaryId) {
          drawAlignmentGuides(id, newX, newY);
        }
        if (dragSession?.moved) {
          emit('element.transient', { id, transform: { x: newX, y: newY } });
        }
      });
      refreshConnectors();
      renderSelection();
      return;
    }

    if (isSelecting && selectionBox) {
      const current = worldPos;
      selectionBox.clear();
      const x = Math.min(selectStart.x, current.x);
      const y = Math.min(selectStart.y, current.y);
      const w = Math.abs(current.x - selectStart.x);
      const h = Math.abs(current.y - selectStart.y);
      selectionBox.rect(x, y, w, h);
      selectionBox.fill({ color: SELECTION_COLOR, alpha: 0.1 });
      selectionBox.stroke({ width: 1 / viewport.zoom, color: SELECTION_COLOR, alpha: 0.6 });
      const rect = new Rectangle(x, y, w, h);
      elementMap.forEach((c, id) => {
        const b = localBoundsToWorld(c);
        if (rect.intersects(new Rectangle(b.x, b.y, b.width, b.height))) {
          selectedIds.add(id);
        } else if (!e.shiftKey) {
          selectedIds.delete(id);
        }
      });
      emitSelection();
      renderSelection();
    }
  }

  function onPointerUp(e: FederatedPointerEvent) {
    if (resizing) {
      endResize();
      return;
    }
    if (connectorDrag) {
      const worldPos = screenToWorld({ x: e.global.x, y: e.global.y });
      const found = getElementAtScreenPoint({ x: e.global.x, y: e.global.y });
      endConnectorDrag(
        found && found.id !== connectorDrag.fromId ? found.id : null,
        found && found.id !== connectorDrag.fromId ? found.anchor : null,
        worldPos,
      );
      return;
    }
    if (drawingMode && currentStroke.length >= 2) {
      if (drawingPreview) {
        drawingPreview.destroy();
        drawingPreview = null;
      }
      const id = uuidv4();
      const el = {
        id,
        type: 'drawing',
        points: currentStroke,
        color: drawingOptions.color,
        strokeWidth: drawingOptions.width,
        mode: drawingOptions.mode,
        transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        style: {},
        metadata: {},
        createdBy: 'local-user',
        updatedAt: new Date().toISOString(),
      } as unknown as CanvasElement;
      engine.createElement(el);
      currentStroke = [];
      return;
    }
    if (drawingMode) {
      currentStroke = [];
      if (drawingPreview) {
        drawingPreview.destroy();
        drawingPreview = null;
      }
    }
    if (dragSession?.moved) {
      const updates: { id: string; patch: Partial<CanvasElement> }[] = [];
      dragSession.startPositions.forEach((_, id) => {
        const c = elementMap.get(id);
        if (!c) return;
        updates.push({ id, patch: { transform: elementModels.get(id)!.transform } });
      });
      updates.forEach(({ id, patch }) => emit('element.updated', { id, patch }));
    }
    dragSession = null;
    isPanning = false;
    isSelecting = false;
    if (selectionBox) {
      selectionBox.destroy();
      selectionBox = null;
    }
    if (app?.stage) app.stage.cursor = 'default';
    clearGuides();
    // Reset hover so the next pointerover re-renders handles in the new position.
    cancelHoverClear();
    destroyChildren(hoverContainer);
    hoveredId = null;
    hoverHandlesVisible = false;
  }

  function drawAlignmentGuides(movingId: string, newX: number, newY: number) {
    if (!showGuides) return;
    clearGuides();
    void newX;
    void newY;

    const movingEl = elementMap.get(movingId);
    if (!movingEl) return;
    const mB = localBoundsToWorld(movingEl);
    const mCx = mB.x + mB.width / 2;
    const mCy = mB.y + mB.height / 2;

    const g = new Graphics();
    let drew = false;

    elementMap.forEach((c, id) => {
      if (id === movingId) return;
      const b = localBoundsToWorld(c);
      const cx = b.x + b.width / 2;
      const cy = b.y + b.height / 2;

      const checks = [
        { val: mB.x, target: b.x, axis: 'x' },
        { val: mB.x + mB.width, target: b.x + b.width, axis: 'x' },
        { val: mCx, target: cx, axis: 'x' },
        { val: mB.y, target: b.y, axis: 'y' },
        { val: mB.y + mB.height, target: b.y + b.height, axis: 'y' },
        { val: mCy, target: cy, axis: 'y' },
      ] as const;

      checks.forEach((check) => {
        if (Math.abs(check.val - check.target) < ALIGN_THRESHOLD / viewport.zoom) {
          drew = true;
          if (check.axis === 'x') {
            g.moveTo(check.target, -10000);
            g.lineTo(check.target, 10000);
          } else {
            g.moveTo(-10000, check.target);
            g.lineTo(10000, check.target);
          }
          g.stroke({ width: 1 / viewport.zoom, color: 0x3b82f6, alpha: 0.6 });
        }
      });
    });

    if (drew) guidesContainer.addChild(g);
  }

  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = 1.1;
    const direction = e.deltaY > 0 ? 1 / factor : factor;
    const newZoom = Math.max(0.1, Math.min(10, viewport.zoom * direction));
    const worldPos = screenToWorld({ x: e.clientX, y: e.clientY });
    viewport.x = worldPos.x - (worldPos.x - viewport.x) * (newZoom / viewport.zoom);
    viewport.y = worldPos.y - (worldPos.y - viewport.y) * (newZoom / viewport.zoom);
    viewport.zoom = newZoom;
    updateWorldTransform();
    renderSelection();
    emit('viewportChange', { ...viewport });
  }

  // Touch (pinch-to-zoom)
  let touchStartDist = 0;
  let touchStartZoom = 1;
  function getTouchDist(touches: TouchList): number {
    if (touches.length < 2) return 0;
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.hypot(dx, dy);
  }
  function getTouchCenter(touches: TouchList): { x: number; y: number } {
    if (touches.length < 2) return { x: touches[0]?.clientX ?? 0, y: touches[0]?.clientY ?? 0 };
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length === 2) {
      touchStartDist = getTouchDist(e.touches);
      touchStartZoom = viewport.zoom;
    }
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length === 2 && touchStartDist > 0) {
      e.preventDefault();
      const dist = getTouchDist(e.touches);
      const newZoom = Math.max(0.1, Math.min(10, touchStartZoom * (dist / touchStartDist)));
      const center = getTouchCenter(e.touches);
      const worldPos = screenToWorld({ x: center.x, y: center.y });
      viewport.x = worldPos.x - (worldPos.x - viewport.x) * (newZoom / viewport.zoom);
      viewport.y = worldPos.y - (worldPos.y - viewport.y) * (newZoom / viewport.zoom);
      viewport.zoom = newZoom;
      updateWorldTransform();
      renderSelection();
    }
  }
  function onTouchEnd() {
    touchStartDist = 0;
  }

  function rebuildElementVisual(id: string) {
    const c = elementMap.get(id);
    const el = elementModels.get(id);
    if (!c || !el) return;
    destroyChildren(c);
    const renderer = rendererRegistry.get(el.type);
    if (renderer) {
      const visual = renderer(el);
      if (visual) {
        c.addChild(visual);
        const ext = ['__getAnchors', '__inlineEditor', '__onUpdate', '__preferredCursor'];
        for (const k of ext) {
          if ((visual as any)[k] !== undefined) (c as any)[k] = (visual as any)[k];
        }
      }
    }
  }

  /**
   * Pixi `Container.removeChildren()` only detaches children — it does not
   * release their GPU resources. Calling it repeatedly (on hover / selection /
   * style updates) leaks Graphics, Text and Sprite objects until the tab
   * eventually freezes. This helper destroys every removed child.
   */
  function destroyChildren(container: Container) {
    const removed = container.removeChildren();
    for (const child of removed) {
      child.destroy({ children: true });
    }
  }

  function rebuildConnector(id: string) {
    const old = connectorsMap.get(id);
    if (old) {
      old.destroy({ children: true });
      connectorsMap.delete(id);
    }
    const el = elementModels.get(id) as ConnectorElement | undefined;
    if (!el) return;
    const from = elementToConnectorEndpoint(el, 'from');
    const to = elementToConnectorEndpoint(el, 'to');
    if (!from || !to) return;
    const c = createConnectorContainer({
      from,
      to,
      styleType: el.styleType,
      arrowStart: el.arrowStart ?? 'none',
      arrowEnd: el.arrowEnd ?? 'triangle',
      lineStyle: el.lineStyle ?? 'solid',
      color: el.strokeColor ?? 0x475569,
      width: el.strokeWidth ?? 2,
      opacity: 1,
      label: el.label,
      containers: elementMap,
    });
    c.eventMode = 'static';
    c.cursor = 'pointer';
    c.on('pointerdown', (e: FederatedPointerEvent) => {
      e.stopPropagation();
      if (e.button === 2) {
        if (!selectedIds.has(id)) {
          selectedIds.clear();
          selectedIds.add(id);
          primarySelectionId = id;
          emitSelection();
          renderSelection();
        }
        emit('contextMenu', {
          screenX: e.global.x,
          screenY: e.global.y,
          worldPoint: screenToWorld({ x: e.global.x, y: e.global.y }),
          targetId: id,
        } as ContextMenuRequest);
        return;
      }
      if (!e.shiftKey) selectedIds.clear();
      selectedIds.add(id);
      primarySelectionId = id;
      emitSelection();
      renderSelection();
    });
    connectorsContainer.addChild(c);
    connectorsMap.set(id, c);
    // Now that the container has a parent (and therefore a world transform),
    // run the first geometry update so the line renders at the correct
    // coordinates immediately.
    const upd = (c as any).__updateConnector as (() => void) | undefined;
    if (upd) upd();
  }

  let initialized = false;
  let resolveReady: () => void;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  const engine: CanvasEngine = {
    app,
    world,
    ready,
    createElement(el, options = {}) {
      elementModels.set(el.id, JSON.parse(JSON.stringify(el)));
      if (el.type === 'connector') {
        rebuildConnector(el.id);
        if (!options.skipEmit) emit('element.created', el);
        return;
      }
      if (elementMap.has(el.id)) return;
      const container = new Container();
      container.name = el.id;
      // Stable id for reverse-lookups (e.g. hit-testing in z-order via
      // `elementsContainer.children`). Pixi v8 deprecates `name` so we
      // shouldn't rely on it.
      (container as any).__elementId = el.id;
      const t = el.transform;
      container.position.set(t.x, t.y);
      container.rotation = t.rotation;
      container.scale.set(t.scaleX, t.scaleY);
      const renderer = rendererRegistry.get(el.type);
      if (renderer) {
        const visual = renderer(el);
        if (visual) {
          container.addChild(visual);
          const ext = ['__getAnchors', '__inlineEditor', '__onUpdate', '__preferredCursor'];
          for (const k of ext) {
            if ((visual as any)[k] !== undefined) (container as any)[k] = (visual as any)[k];
          }
        }
      }
      setupContainerInteractions(container, el);
      elementsContainer.addChild(container);
      elementMap.set(el.id, container);
      // Refresh any connectors that referenced this id and were waiting
      // (e.g. a connector loaded before its endpoint elements existed).
      connectorsMap.forEach((c, cid) => {
        const conn = elementModels.get(cid) as ConnectorElement | undefined;
        if (!conn) return;
        const fromId = conn.from?.kind === 'element' ? conn.from.elementId : conn.fromId;
        const toId = conn.to?.kind === 'element' ? conn.to.elementId : conn.toId;
        if (fromId !== el.id && toId !== el.id) return;
        const fn = (c as any).__updateConnector as (() => void) | undefined;
        if (fn) fn();
      });
      if (!options.skipEmit) emit('element.created', el);
    },
    updateElement(id, patch, options = {}) {
      const current = elementModels.get(id);
      if (!current) return;
      const merged = { ...current, ...patch } as CanvasElement;
      if (patch.transform) {
        merged.transform = { ...current.transform, ...patch.transform };
      }
      if (patch.style) {
        merged.style = { ...(current.style ?? {}), ...patch.style };
      }
      if (patch.metadata) {
        merged.metadata = { ...(current.metadata ?? {}), ...patch.metadata };
      }
      elementModels.set(id, merged);

      if (current.type === 'connector') {
        rebuildConnector(id);
        if (!options.skipEmit) emit('element.updated', { id, patch });
        renderSelection();
        return;
      }

      const container = elementMap.get(id);
      if (container) {
        const t = merged.transform;
        container.position.set(t.x, t.y);
        container.rotation = t.rotation ?? container.rotation;
        container.scale.set(t.scaleX ?? 1, t.scaleY ?? 1);

        const isStructuralChange =
          Object.keys(patch).some((k) => k !== 'transform' && k !== 'metadata');
        if (isStructuralChange) {
          rebuildElementVisual(id);
        }
      }

      // Update incident connectors
      connectorsMap.forEach((_, cid) => {
        const c = elementModels.get(cid) as ConnectorElement | undefined;
        if (!c) return;
        const fromId = c.from?.kind === 'element' ? c.from.elementId : c.fromId;
        const toId = c.to?.kind === 'element' ? c.to.elementId : c.toId;
        if (fromId === id || toId === id) {
          const fn = (connectorsMap.get(cid) as any)?.__updateConnector;
          if (fn) fn();
        }
      });

      if (!options.skipEmit) emit('element.updated', { id, patch });
      renderSelection();
    },
    deleteElement(id, options = {}) {
      elementModels.delete(id);
      const container = elementMap.get(id);
      if (container) {
        container.destroy({ children: true });
        elementMap.delete(id);
      }
      const conn = connectorsMap.get(id);
      if (conn) {
        conn.destroy({ children: true });
        connectorsMap.delete(id);
      }
      // Remove connectors anchored to this element
      const toRemove: string[] = [];
      elementModels.forEach((el, eid) => {
        if (el.type === 'connector') {
          const c = el as ConnectorElement;
          const fromId = c.from?.kind === 'element' ? c.from.elementId : c.fromId;
          const toId = c.to?.kind === 'element' ? c.to.elementId : c.toId;
          if (fromId === id || toId === id) toRemove.push(eid);
        }
      });
      toRemove.forEach((eid) => engine.deleteElement(eid));
      selectedIds.delete(id);
      if (primarySelectionId === id) primarySelectionId = null;
      emitSelection();
      if (!options.skipEmit) emit('element.deleted', { id });
      renderSelection();
    },
    addRandomShape(type) {
      const screen = getScreenSize();
      const point = screenToWorld({
        x: screen.width / 2 + (Math.random() - 0.5) * 200,
        y: screen.height / 2 + (Math.random() - 0.5) * 200,
      });
      return engine.insertElementAt(type, point);
    },
    insertElementAt(type, point, overrides) {
      const id = uuidv4();
      const screen = getScreenSize();
      const worldPoint = point ?? screenToWorld({
        x: screen.width / 2,
        y: screen.height / 2,
      });
      const base = {
        id,
        type,
        transform: { x: worldPoint.x, y: worldPoint.y, rotation: 0, scaleX: 1, scaleY: 1 },
        style: {} as Record<string, unknown>,
        metadata: {},
        createdBy: 'local-user',
        updatedAt: new Date().toISOString(),
      } as unknown as CanvasElement;

      switch (type) {
        case 'rectangle':
          (base as any).size = { width: 160, height: 100 };
          base.style = { fill: 0x3b82f6, stroke: 0x1d4ed8, strokeWidth: 2, cornerRadius: 8 };
          break;
        case 'circle':
        case 'ellipse':
          (base as any).radius = 50;
          base.style = { fill: 0x10b981, stroke: 0x047857, strokeWidth: 2 };
          break;
        case 'sticky_note':
          (base as any).text = '';
          (base as any).size = { width: 180, height: 180 };
          base.style = { fill: 0xfde68a, fontSize: 16 };
          break;
        case 'text':
          (base as any).text = 'Texto';
          (base as any).fontSize = 24;
          base.style = { color: 0x1e293b, fontWeight: '500' };
          break;
        case 'frame':
          (base as any).title = 'Nova seção';
          (base as any).size = { width: 600, height: 400 };
          base.style = { fill: 0xffffff, stroke: 0x94a3b8 };
          break;
        case 'card':
          (base as any).title = 'Nova tarefa';
          (base as any).description = '';
          (base as any).status = 'todo';
          (base as any).priority = 'medium';
          (base as any).tags = [];
          (base as any).size = { width: 260, height: 160 };
          break;
        case 'table':
          (base as any).rows = 3;
          (base as any).cols = 3;
          (base as any).colWidths = [120, 120, 120];
          (base as any).rowHeights = [36, 36, 36];
          (base as any).headerRow = true;
          (base as any).cells = [
            [{ text: 'Coluna 1' }, { text: 'Coluna 2' }, { text: 'Coluna 3' }],
            [{ text: '' }, { text: '' }, { text: '' }],
            [{ text: '' }, { text: '' }, { text: '' }],
          ];
          break;
        default:
          break;
      }

      const merged = overrides ? ({ ...base, ...overrides } as CanvasElement) : base;
      engine.createElement(merged);
      return merged;
    },
    duplicateElement(id) {
      const el = elementModels.get(id);
      if (!el) return null;
      const cloned = JSON.parse(JSON.stringify(el)) as CanvasElement;
      cloned.id = uuidv4();
      cloned.transform = {
        ...cloned.transform,
        x: cloned.transform.x + 24,
        y: cloned.transform.y + 24,
      };
      cloned.updatedAt = new Date().toISOString();
      engine.createElement(cloned);
      return cloned;
    },
    setLocked(id, locked) {
      engine.updateElement(id, { metadata: { locked } } as Partial<CanvasElement>);
    },
    setSelection(ids) {
      selectedIds.clear();
      ids.forEach((id) => selectedIds.add(id));
      primarySelectionId = ids[ids.length - 1] ?? null;
      emitSelection();
      renderSelection();
    },
    getSelection() {
      return { ids: Array.from(selectedIds), primaryId: primarySelectionId };
    },
    getElement(id) {
      return elementModels.get(id) ?? null;
    },
    getElements() {
      return Array.from(elementModels.values());
    },
    getElementBounds(id) {
      const c = elementMap.get(id);
      if (!c) return null;
      return localBoundsToWorld(c);
    },
    getElementScreenRect(id) {
      const c = elementMap.get(id);
      if (!c) return null;
      const b = localBoundsToWorld(c);
      const tl = worldToScreen({ x: b.x, y: b.y });
      const br = worldToScreen({ x: b.x + b.width, y: b.y + b.height });
      const rect = container.getBoundingClientRect();
      return new DOMRect(rect.left + tl.x, rect.top + tl.y, br.x - tl.x, br.y - tl.y);
    },
    getSelectionScreenRect() {
      if (selectedIds.size === 0) return null;
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      selectedIds.forEach((id) => {
        const c = elementMap.get(id);
        if (!c) return;
        const b = localBoundsToWorld(c);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
      });
      if (minX === Infinity) return null;
      const tl = worldToScreen({ x: minX, y: minY });
      const br = worldToScreen({ x: maxX, y: maxY });
      const rect = container.getBoundingClientRect();
      return new DOMRect(rect.left + tl.x, rect.top + tl.y, br.x - tl.x, br.y - tl.y);
    },
    getViewport: () => ({ ...viewport }),
    setViewport(x, y, zoom) {
      viewport = { x, y, zoom };
      updateWorldTransform();
      renderSelection();
      emit('viewportChange', { ...viewport });
    },
    screenToWorld,
    worldToScreen,
    toggleSnapToGrid(enabled) {
      snapToGrid = enabled;
    },
    getSnapToGrid: () => snapToGrid,
    startConnectorMode() {
      connectorMode = true;
      app.stage.cursor = 'crosshair';
    },
    endConnectorMode() {
      connectorMode = false;
      if (connectorDrag) {
        connectorDrag.preview.destroy();
        connectorDrag = null;
      }
      app.stage.cursor = 'default';
    },
    startConnectorFrom(elementId, anchorId, screenPoint) {
      const c = elementMap.get(elementId);
      if (!c) return;
      const fromPoint = screenToWorld(screenPoint);
      // Try to use real anchor world position
      const anchorPt = c.toGlobal(getAnchorPoint(c, anchorId));
      const anchorWorld = world.toLocal(anchorPt);
      startConnectorDragFromPoint({ x: anchorWorld.x, y: anchorWorld.y }, elementId, anchorId);
      void fromPoint;
    },
    computeNearestAnchor(elementId, worldPoint) {
      const c = elementMap.get(elementId);
      if (!c) return null;
      return findNearestAnchor(c, worldPoint).anchor;
    },
    startDrawingMode(options) {
      drawingMode = true;
      drawingOptions = options;
      app.stage.cursor = 'crosshair';
    },
    endDrawingMode() {
      drawingMode = false;
      currentStroke = [];
      if (drawingPreview) {
        drawingPreview.destroy();
        drawingPreview = null;
      }
      app.stage.cursor = 'default';
    },
    beginInlineEdit(id) {
      const c = elementMap.get(id);
      const el = elementModels.get(id);
      if (!c || !el) return;
      const editor = (c as any).__inlineEditor as InlineEditorDescriptor | undefined;
      if (!editor) return;
      editingId = id;
      const visualBounds = editor.bounds ?? localBoundsToWorld(c);
      let bounds: { x: number; y: number; width: number; height: number };
      if (editor.bounds) {
        // Bounds are in local coords relative to element center; translate to world
        bounds = {
          x: el.transform.x + editor.bounds.x,
          y: el.transform.y + editor.bounds.y,
          width: editor.bounds.width,
          height: editor.bounds.height,
        };
      } else {
        bounds = visualBounds;
      }
      const screenTL = worldToScreen({ x: bounds.x, y: bounds.y });
      const screenBR = worldToScreen({ x: bounds.x + bounds.width, y: bounds.y + bounds.height });
      const initial = ((el as any)[editor.field] as string) ?? '';
      emit('inlineEdit.start', {
        id,
        field: editor.field,
        multiline: editor.multiline ?? false,
        bounds: {
          x: screenTL.x,
          y: screenTL.y,
          width: screenBR.x - screenTL.x,
          height: screenBR.y - screenTL.y,
        },
        fontSize: (editor.fontSize ?? 14) * viewport.zoom,
        initialValue: initial,
      } as InlineEditRequest);
    },
    endInlineEdit(commit = true, value) {
      if (!editingId) return;
      const id = editingId;
      editingId = null;
      const editor = (elementMap.get(id) as any)?.__inlineEditor as InlineEditorDescriptor | undefined;
      if (commit && editor && value !== undefined) {
        const patch: Partial<CanvasElement> = { [editor.field]: value } as any;
        engine.updateElement(id, patch);
      }
      emit('inlineEdit.end', { id });
    },
    bringToFront(id) {
      const c = elementMap.get(id);
      if (c) elementsContainer.setChildIndex(c, elementsContainer.children.length - 1);
    },
    sendToBack(id) {
      const c = elementMap.get(id);
      if (c) elementsContainer.setChildIndex(c, 0);
    },
    bringForward(id) {
      const c = elementMap.get(id);
      if (!c) return;
      const idx = elementsContainer.getChildIndex(c);
      if (idx < elementsContainer.children.length - 1) {
        elementsContainer.setChildIndex(c, idx + 1);
      }
    },
    sendBackward(id) {
      const c = elementMap.get(id);
      if (!c) return;
      const idx = elementsContainer.getChildIndex(c);
      if (idx > 0) {
        elementsContainer.setChildIndex(c, idx - 1);
      }
    },
    alignSelection(mode) {
      if (selectedIds.size < 2) return;
      const boxes: { id: string; b: { x: number; y: number; width: number; height: number } }[] = [];
      selectedIds.forEach((id) => {
        const c = elementMap.get(id);
        if (!c) return;
        boxes.push({ id, b: localBoundsToWorld(c) });
      });
      if (boxes.length < 2) return;
      let target = 0;
      if (mode === 'left') target = Math.min(...boxes.map((x) => x.b.x));
      if (mode === 'right') target = Math.max(...boxes.map((x) => x.b.x + x.b.width));
      if (mode === 'center-h') {
        const minX = Math.min(...boxes.map((x) => x.b.x));
        const maxX = Math.max(...boxes.map((x) => x.b.x + x.b.width));
        target = (minX + maxX) / 2;
      }
      if (mode === 'top') target = Math.min(...boxes.map((x) => x.b.y));
      if (mode === 'bottom') target = Math.max(...boxes.map((x) => x.b.y + x.b.height));
      if (mode === 'center-v') {
        const minY = Math.min(...boxes.map((x) => x.b.y));
        const maxY = Math.max(...boxes.map((x) => x.b.y + x.b.height));
        target = (minY + maxY) / 2;
      }
      boxes.forEach(({ id, b }) => {
        const el = elementModels.get(id);
        if (!el) return;
        const t = { ...el.transform };
        if (mode === 'left') t.x += target - b.x;
        if (mode === 'right') t.x += target - (b.x + b.width);
        if (mode === 'center-h') t.x += target - (b.x + b.width / 2);
        if (mode === 'top') t.y += target - b.y;
        if (mode === 'bottom') t.y += target - (b.y + b.height);
        if (mode === 'center-v') t.y += target - (b.y + b.height / 2);
        engine.updateElement(id, { transform: t });
      });
    },
    distributeSelection(mode) {
      if (selectedIds.size < 3) return;
      const boxes = Array.from(selectedIds)
        .map((id) => {
          const c = elementMap.get(id);
          return c ? { id, b: localBoundsToWorld(c) } : null;
        })
        .filter((x): x is { id: string; b: { x: number; y: number; width: number; height: number } } => Boolean(x));
      if (boxes.length < 3) return;
      if (mode === 'horizontal') {
        boxes.sort((a, b) => a.b.x + a.b.width / 2 - (b.b.x + b.b.width / 2));
        const first = boxes[0].b.x + boxes[0].b.width / 2;
        const last = boxes[boxes.length - 1].b.x + boxes[boxes.length - 1].b.width / 2;
        const step = (last - first) / (boxes.length - 1);
        boxes.forEach((box, i) => {
          if (i === 0 || i === boxes.length - 1) return;
          const target = first + step * i;
          const el = elementModels.get(box.id);
          if (!el) return;
          const t = { ...el.transform };
          t.x += target - (box.b.x + box.b.width / 2);
          engine.updateElement(box.id, { transform: t });
        });
      } else {
        boxes.sort((a, b) => a.b.y + a.b.height / 2 - (b.b.y + b.b.height / 2));
        const first = boxes[0].b.y + boxes[0].b.height / 2;
        const last = boxes[boxes.length - 1].b.y + boxes[boxes.length - 1].b.height / 2;
        const step = (last - first) / (boxes.length - 1);
        boxes.forEach((box, i) => {
          if (i === 0 || i === boxes.length - 1) return;
          const target = first + step * i;
          const el = elementModels.get(box.id);
          if (!el) return;
          const t = { ...el.transform };
          t.y += target - (box.b.y + box.b.height / 2);
          engine.updateElement(box.id, { transform: t });
        });
      }
    },
    groupSelection() {
      if (selectedIds.size < 2) return null;
      const groupId = uuidv4();
      selectedIds.forEach((id) => {
        engine.updateElement(id, { metadata: { groupId } } as Partial<CanvasElement>);
      });
      return groupId;
    },
    ungroupSelection() {
      selectedIds.forEach((id) => {
        engine.updateElement(id, { metadata: { groupId: null } } as Partial<CanvasElement>);
      });
    },
    registerRenderer(type, renderer) {
      rendererRegistry.register(type, renderer);
    },
    on(event, handler) {
      if (!events[event]) events[event] = [];
      events[event].push(handler);
    },
    off(event, handler) {
      events[event] = events[event]?.filter((h) => h !== handler) ?? [];
    },
    destroy() {
      cancelHoverClear();
      if (initialized) {
        try {
          app.destroy(true, { children: true });
        } catch {
          // ignore pixi destroy race
        }
      }
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('contextmenu', onContextMenu);
    },
  };

  function onContextMenu(e: MouseEvent) {
    e.preventDefault();
    const rect = container.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const worldPoint = screenToWorld({ x: screenX, y: screenY });
    let targetId: string | null = null;
    elementMap.forEach((c, id) => {
      const b = localBoundsToWorld(c);
      if (worldPoint.x >= b.x && worldPoint.x <= b.x + b.width && worldPoint.y >= b.y && worldPoint.y <= b.y + b.height) {
        targetId = id;
      }
    });
    if (targetId && !selectedIds.has(targetId)) {
      selectedIds.clear();
      selectedIds.add(targetId);
      primarySelectionId = targetId;
      emitSelection();
      renderSelection();
    }
    emit('contextMenu', {
      screenX: e.clientX,
      screenY: e.clientY,
      worldPoint,
      targetId,
    } as ContextMenuRequest);
  }

  registerBuiltinRenderers();

  app.init({
    resizeTo: container,
    backgroundColor: 0xf8fafc,
    antialias: true,
    autoDensity: true,
    resolution: window.devicePixelRatio || 1,
  }).then(() => {
    initialized = true;
    container.appendChild(app.canvas);
    app.stage.addChild(world);
    app.stage.eventMode = 'static';
    app.stage.hitArea = app.screen;
    app.stage.on('pointerdown', onPointerDown);
    app.stage.on('pointermove', onPointerMove);
    app.stage.on('pointerup', onPointerUp);
    app.stage.on('pointerupoutside', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('contextmenu', onContextMenu);
    updateWorldTransform();
    resolveReady();
  });

  // Ensure anchors are accessible from outside (used by render hover handles)
  void getAnchorDescriptors;

  return engine;
}
