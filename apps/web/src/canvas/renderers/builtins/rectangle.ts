import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderRectangle: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 120, height: 80 };
  const fill = (el.style?.fill as number) ?? 0x3b82f6;
  const stroke = (el.style?.stroke as number) ?? 0x1d4ed8;
  const strokeWidth = (el.style?.strokeWidth as number) ?? 2;
  const radius = (el.style?.cornerRadius as number) ?? 8;
  const opacity = (el.style?.opacity as number) ?? 1;
  const text = (el as any).text as string | undefined;

  const g = new Graphics();
  if (radius > 0) {
    g.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, radius);
  } else {
    g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
  }
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
        wordWrapWidth: size.width - 16,
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
    bounds: { x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height },
  };

  return container;
};
