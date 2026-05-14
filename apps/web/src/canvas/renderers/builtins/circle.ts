import { Container, Graphics } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

/**
 * Pure shape renderer — text now lives in a child `text` element. See
 * `stickyNote.ts` for the rationale.
 */
export const renderCircle: ElementRenderer = (el) => {
  const container = new Container();
  const radius = (el as any).radius ?? 50;
  const fill = (el.style?.fill as number) ?? 0x10b981;
  const stroke = (el.style?.stroke as number) ?? 0x047857;
  const strokeWidth = (el.style?.strokeWidth as number) ?? 2;
  const opacity = (el.style?.opacity as number) ?? 1;

  const g = new Graphics();
  g.circle(0, 0, radius);
  g.fill({ color: fill, alpha: opacity });
  if (strokeWidth > 0) g.stroke({ width: strokeWidth, color: stroke, alpha: opacity });
  container.addChild(g);

  return container;
};
