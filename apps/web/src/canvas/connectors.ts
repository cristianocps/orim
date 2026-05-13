import { Graphics, Container, Text, TextStyle } from 'pixi.js';
import type {
  ConnectorAnchorId,
  ConnectorArrowStyle,
  ConnectorElement,
  ConnectorEndpoint,
  ConnectorLineStyle,
  Point,
} from '@orim/shared';

export type Anchor = 'top' | 'bottom' | 'left' | 'right' | 'center';

export interface AnchorDescriptor {
  id: ConnectorAnchorId;
  /** Position relative to element local center, normalized [-0.5, 0.5] */
  nx: number;
  ny: number;
  label?: string;
  direction?: 'in' | 'out' | 'both';
}

const FALLBACK_ANCHORS: AnchorDescriptor[] = [
  { id: 'top', nx: 0, ny: -0.5 },
  { id: 'right', nx: 0.5, ny: 0 },
  { id: 'bottom', nx: 0, ny: 0.5 },
  { id: 'left', nx: -0.5, ny: 0 },
  { id: 'center', nx: 0, ny: 0 },
];

export function getAnchorDescriptors(container: Container): AnchorDescriptor[] {
  const provider = (container as any).__getAnchors as (() => AnchorDescriptor[]) | undefined;
  if (provider) {
    try {
      return provider();
    } catch {
      // ignore renderer errors and fall back
    }
  }
  return FALLBACK_ANCHORS;
}

export function getAnchorPoint(container: Container, anchorId: ConnectorAnchorId): Point {
  const anchors = getAnchorDescriptors(container);
  const anchor = anchors.find((a) => a.id === anchorId) ?? anchors[0];
  const bounds = container.getLocalBounds();
  return {
    x: bounds.x + bounds.width / 2 + anchor.nx * bounds.width,
    y: bounds.y + bounds.height / 2 + anchor.ny * bounds.height,
  };
}

export function findNearestAnchor(
  container: Container,
  worldPoint: Point,
): { anchor: ConnectorAnchorId; point: Point } {
  const anchors = getAnchorDescriptors(container).filter((a) => a.id !== 'center');
  let nearest: AnchorDescriptor = anchors[0] ?? FALLBACK_ANCHORS[0];
  let minDist = Infinity;

  // worldPoint is in world (scene) coords. Anchor points returned by
  // getAnchorPoint are in container-local coords. We convert each to world
  // coords via parent.toLocal(container.toGlobal(...)) so the comparison
  // happens in the same space. Without this, we were comparing world vs
  // global/screen coords, which made the leftmost anchor (smallest screen X)
  // always "win" — visually that surfaces as connectors snapping to the left
  // side of the destination element regardless of drop position.
  const parent = container.parent;
  for (const anchor of anchors) {
    const localPt = getAnchorPoint(container, anchor.id);
    const globalPt = container.toGlobal(localPt);
    const cmpPt = parent ? parent.toLocal(globalPt) : globalPt;
    const dx = cmpPt.x - worldPoint.x;
    const dy = cmpPt.y - worldPoint.y;
    const dist = Math.hypot(dx, dy);
    if (dist < minDist) {
      minDist = dist;
      nearest = anchor;
    }
  }

  return {
    anchor: nearest.id,
    point: getAnchorPoint(container, nearest.id),
  };
}

export interface ConnectorRenderOptions {
  styleType: 'straight' | 'curved' | 'elbow';
  color: number;
  width: number;
  lineStyle: ConnectorLineStyle;
  arrowStart: ConnectorArrowStyle;
  arrowEnd: ConnectorArrowStyle;
  opacity: number;
}

export function drawConnector(
  g: Graphics,
  from: Point,
  to: Point,
  options: ConnectorRenderOptions,
) {
  g.clear();
  const { styleType, color, width, lineStyle, arrowStart, arrowEnd, opacity } = options;

  const strokeOptions: Record<string, unknown> = { width, color, alpha: opacity };
  if (lineStyle === 'dashed') {
    // Pixi v8 lacks first-class dash; we emulate with segmented draw below.
  }

  if (lineStyle === 'solid') {
    drawPath(g, from, to, styleType);
    g.stroke(strokeOptions);
  } else {
    drawDashedPath(g, from, to, styleType, lineStyle === 'dotted' ? [2, 4] : [8, 6]);
    g.stroke(strokeOptions);
  }

  if (arrowEnd !== 'none') {
    drawArrowHead(g, from, to, color, opacity, arrowEnd);
  }
  if (arrowStart !== 'none') {
    drawArrowHead(g, to, from, color, opacity, arrowStart);
  }
}

function drawPath(g: Graphics, from: Point, to: Point, style: 'straight' | 'curved' | 'elbow') {
  if (style === 'straight') {
    g.moveTo(from.x, from.y);
    g.lineTo(to.x, to.y);
  } else if (style === 'curved') {
    const midX = (from.x + to.x) / 2;
    g.moveTo(from.x, from.y);
    g.bezierCurveTo(midX, from.y, midX, to.y, to.x, to.y);
  } else if (style === 'elbow') {
    const midX = (from.x + to.x) / 2;
    g.moveTo(from.x, from.y);
    g.lineTo(midX, from.y);
    g.lineTo(midX, to.y);
    g.lineTo(to.x, to.y);
  }
}

function drawDashedPath(
  g: Graphics,
  from: Point,
  to: Point,
  style: 'straight' | 'curved' | 'elbow',
  pattern: [number, number],
) {
  // For curved/elbow we sample the path; for straight we segment directly.
  const points = samplePath(from, to, style, 32);
  let on = true;
  let remaining = pattern[0];
  let prev = points[0];
  g.moveTo(prev.x, prev.y);
  for (let i = 1; i < points.length; i++) {
    const next = points[i];
    let segLen = Math.hypot(next.x - prev.x, next.y - prev.y);
    let cur = prev;
    while (segLen > 0) {
      const step = Math.min(remaining, segLen);
      const t = step / segLen;
      const px = cur.x + (next.x - cur.x) * t;
      const py = cur.y + (next.y - cur.y) * t;
      if (on) {
        g.lineTo(px, py);
      } else {
        g.moveTo(px, py);
      }
      cur = { x: px, y: py };
      segLen -= step;
      remaining -= step;
      if (remaining <= 0) {
        on = !on;
        remaining = on ? pattern[0] : pattern[1];
      }
    }
    prev = next;
  }
}

function samplePath(
  from: Point,
  to: Point,
  style: 'straight' | 'curved' | 'elbow',
  steps: number,
): Point[] {
  const out: Point[] = [];
  if (style === 'straight') {
    out.push(from, to);
    return out;
  }
  if (style === 'elbow') {
    const midX = (from.x + to.x) / 2;
    out.push(from, { x: midX, y: from.y }, { x: midX, y: to.y }, to);
    return out;
  }
  const midX = (from.x + to.x) / 2;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x =
      (1 - t) ** 3 * from.x +
      3 * (1 - t) ** 2 * t * midX +
      3 * (1 - t) * t ** 2 * midX +
      t ** 3 * to.x;
    const y =
      (1 - t) ** 3 * from.y +
      3 * (1 - t) ** 2 * t * from.y +
      3 * (1 - t) * t ** 2 * to.y +
      t ** 3 * to.y;
    out.push({ x, y });
  }
  return out;
}

function drawArrowHead(
  g: Graphics,
  from: Point,
  to: Point,
  color: number,
  opacity: number,
  style: ConnectorArrowStyle,
) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const size = 10;

  if (style === 'triangle') {
    const ax = to.x - size * Math.cos(angle - Math.PI / 6);
    const ay = to.y - size * Math.sin(angle - Math.PI / 6);
    const bx = to.x - size * Math.cos(angle + Math.PI / 6);
    const by = to.y - size * Math.sin(angle + Math.PI / 6);
    g.moveTo(to.x, to.y);
    g.lineTo(ax, ay);
    g.lineTo(bx, by);
    g.lineTo(to.x, to.y);
    g.fill({ color, alpha: opacity });
  } else if (style === 'diamond') {
    const tipX = to.x;
    const tipY = to.y;
    const baseX = to.x - size * Math.cos(angle);
    const baseY = to.y - size * Math.sin(angle);
    const sideX = (size / 2) * Math.cos(angle - Math.PI / 2);
    const sideY = (size / 2) * Math.sin(angle - Math.PI / 2);
    g.moveTo(tipX, tipY);
    g.lineTo(baseX + sideX, baseY + sideY);
    g.lineTo(to.x - 2 * size * Math.cos(angle), to.y - 2 * size * Math.sin(angle));
    g.lineTo(baseX - sideX, baseY - sideY);
    g.lineTo(tipX, tipY);
    g.fill({ color, alpha: opacity });
  } else if (style === 'circle') {
    g.circle(to.x - (size / 2) * Math.cos(angle), to.y - (size / 2) * Math.sin(angle), size / 2);
    g.fill({ color, alpha: opacity });
  }
}

export function resolveEndpointPoint(
  endpoint: ConnectorEndpoint,
  containers: Map<string, Container>,
): Point | null {
  if (endpoint.kind === 'point') return { x: endpoint.x, y: endpoint.y };
  const container = containers.get(endpoint.elementId);
  if (!container) return null;
  return container.toGlobal(getAnchorPoint(container, endpoint.anchorId));
}

export interface CreateConnectorContainerOptions {
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  styleType: 'straight' | 'curved' | 'elbow';
  arrowStart: ConnectorArrowStyle;
  arrowEnd: ConnectorArrowStyle;
  lineStyle: ConnectorLineStyle;
  color: number;
  width: number;
  opacity: number;
  label?: string;
  containers: Map<string, Container>;
}

export function createConnectorContainer(opts: CreateConnectorContainerOptions): Container {
  const container = new Container();
  const g = new Graphics();
  container.addChild(g);

  let labelText: Text | null = null;
  if (opts.label) {
    labelText = new Text({
      text: opts.label,
      style: new TextStyle({
        fontSize: 11,
        fill: 0x1e293b,
        fontWeight: '500',
      }),
    });
    labelText.anchor.set(0.5);
    container.addChild(labelText);
  }

  const settings: ConnectorRenderOptions = {
    styleType: opts.styleType,
    color: opts.color,
    width: opts.width,
    lineStyle: opts.lineStyle,
    arrowStart: opts.arrowStart,
    arrowEnd: opts.arrowEnd,
    opacity: opts.opacity,
  };

  let currentFrom = opts.from;
  let currentTo = opts.to;
  let currentLabel = opts.label ?? '';

  const update = () => {
    const fromPt = resolveEndpointPoint(currentFrom, opts.containers);
    const toPt = resolveEndpointPoint(currentTo, opts.containers);
    if (!fromPt || !toPt) {
      g.clear();
      return;
    }
    const localFrom = container.toLocal(fromPt);
    const localTo = container.toLocal(toPt);
    drawConnector(g, localFrom, localTo, settings);
    if (labelText) {
      labelText.position.set((localFrom.x + localTo.x) / 2, (localFrom.y + localTo.y) / 2 - 12);
    }
  };

  const setEndpoints = (from: ConnectorEndpoint, to: ConnectorEndpoint) => {
    currentFrom = from;
    currentTo = to;
    update();
  };

  const setStyle = (
    next: Partial<{
      styleType: 'straight' | 'curved' | 'elbow';
      color: number;
      width: number;
      lineStyle: ConnectorLineStyle;
      arrowStart: ConnectorArrowStyle;
      arrowEnd: ConnectorArrowStyle;
      opacity: number;
      label: string;
    }>,
  ) => {
    Object.assign(settings, next);
    if (typeof next.label === 'string') {
      currentLabel = next.label;
      if (next.label) {
        if (!labelText) {
          labelText = new Text({
            text: next.label,
            style: new TextStyle({ fontSize: 11, fill: 0x1e293b, fontWeight: '500' }),
          });
          labelText.anchor.set(0.5);
          container.addChild(labelText);
        } else {
          labelText.text = next.label;
        }
      } else if (labelText) {
        labelText.destroy();
        labelText = null;
      }
    }
    update();
  };

  const getEndpoints = () => ({ from: currentFrom, to: currentTo, label: currentLabel });

  (container as any).__updateConnector = update;
  (container as any).__setEndpoints = setEndpoints;
  (container as any).__setStyle = setStyle;
  (container as any).__getEndpoints = getEndpoints;

  // NOTE: do NOT call update() here. The container has no parent yet so
  // toLocal/toGlobal would not honor the world transform, producing a line
  // drawn at the wrong position. The caller must add the container to the
  // scene first and then invoke __updateConnector().
  return container;
}

export function elementToConnectorEndpoint(
  el: Pick<ConnectorElement, 'fromId' | 'fromAnchor' | 'toId' | 'toAnchor' | 'from' | 'to'>,
  side: 'from' | 'to',
): ConnectorEndpoint | null {
  const ep = el[side];
  if (ep) return ep;
  const id = side === 'from' ? el.fromId : el.toId;
  const anchor = side === 'from' ? el.fromAnchor : el.toAnchor;
  if (id) {
    return { kind: 'element', elementId: id, anchorId: anchor ?? 'center' };
  }
  return null;
}
