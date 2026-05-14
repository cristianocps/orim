import { Container, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderText: ElementRenderer = (el) => {
  const container = new Container();
  // Default to '' (NOT to a placeholder string like 'Texto') when the
  // element has no text. The InlineEditor uses the same `?? ''` fallback
  // to compute its initialValue — the two MUST agree, otherwise opening
  // and closing the editor without typing would commit '' over a model
  // that displayed 'Texto' as a renderer-side placeholder, and the
  // visible text would "disappear". The factory (`insertElementAt`) and
  // the migration script both seed `text: ''` explicitly, so legitimate
  // empty texts render as empty (and a top-level text element seeds
  // `text: 'Texto'` in its model so the user sees that).
  const text = (el as any).text ?? '';
  // Allow fontSize from either the top-level legacy field or the shared
  // `style.fontSize` so the unified textFormatProvider can drive both.
  const fontSize = (el as any).fontSize ?? (el.style?.fontSize as number | undefined) ?? 24;
  const fontFamily = (el as any).fontFamily ?? 'Inter, system-ui, sans-serif';
  const color = (el.style?.color as number) ?? 0x1e293b;
  const fontWeight = (el.style?.fontWeight as string) ?? '500';
  const fontStyle = (el.style?.fontStyle as 'normal' | 'italic') ?? 'normal';
  const align = (el.style?.align as 'left' | 'center' | 'right') ?? 'left';
  // wordWrapWidth is computed by the engine from the parent shape's inner
  // box (see `computeChildTextLayout`). When present, the text wraps to fit
  // — without this, long sticky/card content overflows the shape and
  // becomes unreadable. Top-level text elements (no parent) typically
  // leave it unset and grow naturally.
  const wordWrapWidth = (el as any).wordWrapWidth as number | undefined;

  const txt = new Text({
    text,
    style: new TextStyle({
      fontSize,
      fontFamily,
      fontWeight: fontWeight as any,
      fontStyle,
      align,
      fill: color,
      wordWrap: wordWrapWidth !== undefined && wordWrapWidth > 0,
      wordWrapWidth: wordWrapWidth ?? 0,
      // Without `breakWords`, a single very long word (a URL, a hash, an
      // unbroken table key) blows past `wordWrapWidth` and overflows the
      // parent. Breaking mid-word keeps the rendered text inside the box.
      breakWords: true,
    }),
  });
  txt.anchor.set(0.5);
  container.addChild(txt);

  const cssColor = `#${color.toString(16).padStart(6, '0')}`;

  (container as any).__inlineEditor = {
    field: 'text',
    multiline: true,
    fontSize,
    padding: 4,
    color: cssColor,
    // Text element has no fill — give the editor a soft white card so it's
    // distinguishable from the background but doesn't blast contrast.
    background: 'rgba(255,255,255,0.95)',
  };

  return container;
};
