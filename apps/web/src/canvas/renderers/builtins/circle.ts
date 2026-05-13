import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderCircle: ElementRenderer = (el) => {
  const container = new Container();
  const radius = (el as any).radius ?? 50;
  const fill = (el.style?.fill as number) ?? 0x10b981;
  const stroke = (el.style?.stroke as number) ?? 0x047857;
  const strokeWidth = (el.style?.strokeWidth as number) ?? 2;
  const opacity = (el.style?.opacity as number) ?? 1;
  const text = (el as any).text as string | undefined;

  const g = new Graphics();
  g.circle(0, 0, radius);
  g.fill({ color: fill, alpha: opacity });
  if (strokeWidth > 0) g.stroke({ width: strokeWidth, color: stroke, alpha: opacity });
  container.addChild(g);

  if (text) {
    const txt = new Text({
      text,
      style: new TextStyle({
        fontSize: 14,
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: radius * 1.6,
        align: 'center',
      }),
    });
    txt.anchor.set(0.5);
    container.addChild(txt);
  }

  (container as any).__inlineEditor = {
    field: 'text',
    multiline: false,
    fontSize: 14,
    padding: 8,
    bounds: { x: -radius * 0.7, y: -radius * 0.7, width: radius * 1.4, height: radius * 1.4 },
  };

  return container;
};
