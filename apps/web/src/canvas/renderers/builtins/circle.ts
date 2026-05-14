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
  const fontSize = (el.style?.fontSize as number) ?? 14;
  const textColor = (el.style?.color as number) ?? 0xffffff;
  const fontWeight = ((el.style?.fontWeight as string) ?? '500') as any;
  const fontStyle = ((el.style?.fontStyle as 'normal' | 'italic') ?? 'normal');
  const align = ((el.style?.align as 'left' | 'center' | 'right') ?? 'center');

  const g = new Graphics();
  g.circle(0, 0, radius);
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
        wordWrapWidth: radius * 1.6,
        align,
      }),
    });
    txt.anchor.set(0.5);
    container.addChild(txt);
  }

  const cssBg = `#${fill.toString(16).padStart(6, '0')}`;
  const cssColor = `#${textColor.toString(16).padStart(6, '0')}`;

  (container as any).__inlineEditor = {
    field: 'text',
    multiline: true,
    fontSize,
    padding: 8,
    bounds: { x: -radius * 0.7, y: -radius * 0.7, width: radius * 1.4, height: radius * 1.4 },
    color: cssColor,
    background: cssBg,
  };

  return container;
};
