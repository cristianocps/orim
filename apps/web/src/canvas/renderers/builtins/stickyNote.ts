import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

function pickContrastingColor(hex: number): number {
  const r = (hex >> 16) & 0xff;
  const g = (hex >> 8) & 0xff;
  const b = hex & 0xff;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? 0x1e293b : 0xffffff;
}

export const renderStickyNote: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 180, height: 180 };
  const text = (el as any).text ?? '';
  const fill = (el.style?.fill as number) ?? 0xfde68a;
  const textColor = (el.style?.color as number) ?? pickContrastingColor(fill);
  const fontSize = (el.style?.fontSize as number) ?? 16;
  const fontWeight = ((el.style?.fontWeight as string) ?? '500') as any;
  const fontStyle = ((el.style?.fontStyle as 'normal' | 'italic') ?? 'normal');
  const align = ((el.style?.align as 'left' | 'center' | 'right') ?? 'center');

  const shadow = new Graphics();
  shadow.rect(-size.width / 2 + 4, -size.height / 2 + 6, size.width, size.height);
  shadow.fill({ color: 0x000000, alpha: 0.08 });
  container.addChild(shadow);

  const g = new Graphics();
  g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
  g.fill({ color: fill });
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
        wordWrapWidth: size.width - 24,
        align,
      }),
    });
    // anchor.x mirrors the alignment so the text block hugs the chosen edge
    // instead of the renderer always centering it after the fact.
    const ax = align === 'left' ? 0 : align === 'right' ? 1 : 0.5;
    txt.anchor.set(ax, 0.5);
    const offsetX = align === 'left' ? -size.width / 2 + 12 : align === 'right' ? size.width / 2 - 12 : 0;
    txt.position.set(offsetX, 0);
    container.addChild(txt);
  } else {
    const placeholder = new Text({
      text: 'Clique duplo para editar',
      style: new TextStyle({
        fontSize: 12,
        fill: textColor,
        fontStyle: 'italic',
        align: 'center',
      }),
    });
    placeholder.anchor.set(0.5);
    placeholder.alpha = 0.4;
    container.addChild(placeholder);
  }

  // Editor colors mirror the rendered sticky so the overlay blends in
  // (yellow paper with dark/light contrasting text). Without these the
  // engine falls back to white-on-slate-900 which clashes visually.
  const cssBg = `#${fill.toString(16).padStart(6, '0')}`;
  const cssColor = `#${textColor.toString(16).padStart(6, '0')}`;

  (container as any).__inlineEditor = {
    field: 'text',
    multiline: true,
    fontSize,
    padding: 12,
    bounds: { x: -size.width / 2, y: -size.height / 2, width: size.width, height: size.height },
    color: cssColor,
    background: cssBg,
  };

  return container;
};
