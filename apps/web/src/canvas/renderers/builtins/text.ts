import { Container, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderText: ElementRenderer = (el) => {
  const container = new Container();
  const text = (el as any).text ?? 'Texto';
  const fontSize = (el as any).fontSize ?? 24;
  const fontFamily = (el as any).fontFamily ?? 'Inter, system-ui, sans-serif';
  const color = (el.style?.color as number) ?? 0x1e293b;
  const fontWeight = (el.style?.fontWeight as string) ?? '500';
  const fontStyle = (el.style?.fontStyle as 'normal' | 'italic') ?? 'normal';
  const align = (el.style?.align as 'left' | 'center' | 'right') ?? 'left';

  const txt = new Text({
    text,
    style: new TextStyle({
      fontSize,
      fontFamily,
      fontWeight: fontWeight as any,
      fontStyle,
      align,
      fill: color,
    }),
  });
  txt.anchor.set(0.5);
  container.addChild(txt);

  (container as any).__inlineEditor = {
    field: 'text',
    multiline: true,
    fontSize,
    padding: 4,
  };

  return container;
};
