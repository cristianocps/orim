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

  // Draw arrows AFTER stroking so each fill consumes a fresh path. The
  // tangent at each endpoint is computed from the actual line geometry
  // (curved/elbow), so the arrow head visually continues the line instead
  // of pointing along the straight from→to direction (which used to make
  // arrows look detached or sideways on curved/elbow connectors).
  if (arrowEnd !== 'none') {
    const endTangent = endTangentFor(from, to, styleType);
    drawArrowHead(g, to, endTangent, color, opacity, arrowEnd, width);
  }
  if (arrowStart !== 'none') {
    const startTangent = startTangentFor(from, to, styleType);
    drawArrowHead(g, from, startTangent, color, opacity, arrowStart, width);
  }
}

/**
 * Tangent direction (unit vector) at the END of the connector path. For
 * straight lines this is just (to - from). For elbow we use the last
 * segment direction. For curved bezier we approximate with the derivative
 * at t=1 which equals 3 * (P3 - P2) where P2 is the second control point
 * — sitting at (midX, to.y) here, so the curve approaches `to` horizontally
 * unless from.x == to.x.
 */
function endTangentFor(from: Point, to: Point, style: 'straight' | 'curved' | 'elbow'): Point {
  if (style === 'straight') return normalize({ x: to.x - from.x, y: to.y - from.y });
  if (style === 'elbow') {
    const midX = (from.x + to.x) / 2;
    // Last segment goes (midX, to.y) → (to.x, to.y). Direction is sign(to.x - midX) on x.
    const dx = to.x - midX;
    if (Math.abs(dx) < 1e-3) return { x: 0, y: to.y >= from.y ? 1 : -1 };
    return { x: dx > 0 ? 1 : -1, y: 0 };
  }
  // curved: derivative at t=1 of bezier with cps (midX, from.y), (midX, to.y)
  // is 3 * ((to.x, to.y) - (midX, to.y)) = (3*(to.x - midX), 0).
  const midX = (from.x + to.x) / 2;
  const dx = to.x - midX;
  if (Math.abs(dx) < 1e-3) return { x: 0, y: to.y >= from.y ? 1 : -1 };
  return { x: dx > 0 ? 1 : -1, y: 0 };
}

function startTangentFor(from: Point, to: Point, style: 'straight' | 'curved' | 'elbow'): Point {
  if (style === 'straight') return normalize({ x: from.x - to.x, y: from.y - to.y });
  if (style === 'elbow') {
    const midX = (from.x + to.x) / 2;
    // First segment goes (from.x, from.y) → (midX, from.y). Reverse direction
    // points the start arrow tip away from the next segment.
    const dx = from.x - midX;
    if (Math.abs(dx) < 1e-3) return { x: 0, y: from.y >= to.y ? 1 : -1 };
    return { x: dx > 0 ? 1 : -1, y: 0 };
  }
  // curved: derivative at t=0 is 3 * ((midX, from.y) - (from.x, from.y))
  // = (3*(midX - from.x), 0). Reverse to point the arrowhead OUTWARD.
  const midX = (from.x + to.x) / 2;
  const dx = from.x - midX;
  if (Math.abs(dx) < 1e-3) return { x: 0, y: from.y >= to.y ? 1 : -1 };
  return { x: dx > 0 ? 1 : -1, y: 0 };
}

function normalize(v: Point): Point {
  const m = Math.hypot(v.x, v.y);
  if (m < 1e-6) return { x: 1, y: 0 };
  return { x: v.x / m, y: v.y / m };
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

/**
 * Draw an arrow head with its tip at `tip` pointing in the direction of
 * `tangent` (unit vector, points OUT of the line at that endpoint).
 *
 * `strokeWidth` is the connector's stroke width. The arrow scales with it
 * so that a 1px line gets a small head and a 6px line gets a noticeably
 * larger one — without scaling, fat lines collide visually with the
 * triangle base.
 */
function drawArrowHead(
  g: Graphics,
  tip: Point,
  tangent: Point,
  color: number,
  opacity: number,
  style: ConnectorArrowStyle,
  strokeWidth: number,
) {
  const angle = Math.atan2(tangent.y, tangent.x);
  // Base size 10, grow ~3px per extra stroke pixel beyond 1.
  const size = 10 + Math.max(0, strokeWidth - 1) * 3;

  if (style === 'triangle') {
    // The tip sits at the endpoint. Two base corners are `size` back along
    // the tangent, splayed ±30° so the triangle has a visible width.
    const ax = tip.x - size * Math.cos(angle - Math.PI / 6);
    const ay = tip.y - size * Math.sin(angle - Math.PI / 6);
    const bx = tip.x - size * Math.cos(angle + Math.PI / 6);
    const by = tip.y - size * Math.sin(angle + Math.PI / 6);
    g.moveTo(tip.x, tip.y);
    g.lineTo(ax, ay);
    g.lineTo(bx, by);
    g.closePath();
    g.fill({ color, alpha: opacity });
    // Stroke the outline too so the head looks crisp at low zoom levels.
    g.stroke({ width: 1, color, alpha: opacity });
  } else if (style === 'diamond') {
    // Diamond: tip → right-side mid → tail (2*size back) → left-side mid → close
    const halfBackX = tip.x - size * Math.cos(angle);
    const halfBackY = tip.y - size * Math.sin(angle);
    const sideX = (size / 2) * Math.cos(angle - Math.PI / 2);
    const sideY = (size / 2) * Math.sin(angle - Math.PI / 2);
    const tailX = tip.x - 2 * size * Math.cos(angle);
    const tailY = tip.y - 2 * size * Math.sin(angle);
    g.moveTo(tip.x, tip.y);
    g.lineTo(halfBackX + sideX, halfBackY + sideY);
    g.lineTo(tailX, tailY);
    g.lineTo(halfBackX - sideX, halfBackY - sideY);
    g.closePath();
    g.fill({ color, alpha: opacity });
    g.stroke({ width: 1, color, alpha: opacity });
  } else if (style === 'circle') {
    const cx = tip.x - (size / 2) * Math.cos(angle);
    const cy = tip.y - (size / 2) * Math.sin(angle);
    g.circle(cx, cy, size / 2);
    g.fill({ color, alpha: opacity });
    g.stroke({ width: 1, color, alpha: opacity });
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
