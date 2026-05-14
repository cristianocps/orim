import { Container, Graphics } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

/**
 * Pure shape renderer — text now lives in a child `text` element. See
 * `stickyNote.ts` for the rationale; the same model applies here.
 */
export const renderRectangle: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 120, height: 80 };
  const fill = (el.style?.fill as number) ?? 0x3b82f6;
  const stroke = (el.style?.stroke as number) ?? 0x1d4ed8;
  const strokeWidth = (el.style?.strokeWidth as number) ?? 2;
  const radius = (el.style?.cornerRadius as number) ?? 8;
  const opacity = (el.style?.opacity as number) ?? 1;

  const g = new Graphics();
  if (radius > 0) {
    g.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, radius);
  } else {
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
  }
  g.fill({ color: fill, alpha: opacity });
  if (strokeWidth > 0) g.stroke({ width: strokeWidth, color: stroke, alpha: opacity });
  container.addChild(g);

  return container;
};
