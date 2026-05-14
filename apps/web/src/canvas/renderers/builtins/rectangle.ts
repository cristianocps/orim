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
  const fontSize = (el.style?.fontSize as number) ?? 14;
  const textColor = (el.style?.color as number) ?? 0xffffff;
  const fontWeight = ((el.style?.fontWeight as string) ?? '500') as any;
  const fontStyle = ((el.style?.fontStyle as 'normal' | 'italic') ?? 'normal');
  const align = ((el.style?.align as 'left' | 'center' | 'right') ?? 'center');

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
        fontSize,
        fontWeight,
        fontStyle,
        fill: textColor,
        wordWrap: true,
        wordWrapWidth: size.width - 16,
        align,
      }),
    });
    const ax = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    txt.anchor.set(ax, 0.5);
    const offsetX = align === 'left' ? -size.width / 2 + 8 : align === 'right' ? size.width / 2 - 8 : 0;
    txt.position.set(offsetX, 0);
    container.addChild(txt);
  }

  const cssBg = `#${fill.toString(16).padStart(6, '0')}`;
  const cssColor = `#${textColor.toString(16).padStart(6, '0')}`;

  (container as any).__inlineEditor = {
    field: 'text',
    // Rectangles often span multiple lines (cards, labels). Allowing
    // multiline avoids the editor swallowing newlines as commit.
    multiline: true,
    fontSize,
    padding: 8,
    bounds: { x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height },
    color: cssColor,
    background: cssBg,
  };

  return container;
};
