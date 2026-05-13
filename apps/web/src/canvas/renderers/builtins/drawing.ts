import { Container } from 'pixi.js';
import type { ElementRenderer } from '../types.js';
import { createStrokeGraphics } from '../../freehand.js';

export const renderDrawing: ElementRenderer = (el) => {
  const container = new Container();
  const points = (el as any).points ?? [];
  const color = (el as any).color ?? (el.style?.color as number) ?? 0x1e293b;
  const strokeWidth = (el as any).strokeWidth ?? (el.style?.strokeWidth as number) ?? 2;
  const mode = (el as any).mode ?? 'pen';
  const opacity = (el.style?.opacity as number) ?? 1;

  if (points.length >= 2) {
    const g = createStrokeGraphics({
      points,
      color,
      width: strokeWidth,
      opacity,
      mode,
    });
    container.addChild(g);
  }

  return container;
};
