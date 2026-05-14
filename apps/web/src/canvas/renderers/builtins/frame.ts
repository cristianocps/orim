import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

const TITLE_HEIGHT = 26;

export const renderFrame: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 600, height: 400 };
  const title = (el as any).title ?? 'Frame';
  const fill = (el.style?.fill as number) ?? 0xffffff;
  const stroke = (el.style?.stroke as number) ?? 0x94a3b8;

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  // Frame body (single rect — keeps localBounds == size so resize handles
  // and resize math behave like every other "rect with size" element).
  // Previously the title bar lived in negative-Y space outside the body,
  // which made bounds.height = size.height + 28 and inflated `size.height`
  // by 28 on every resize until the engine learned to subtract the offset.
  const g = new Graphics();
  g.rect(-halfW, -halfH, size.width, size.height);
  g.fill({ color: fill, alpha: 0.5 });
  g.stroke({ width: 2, color: stroke, alpha: 0.6 });
  container.addChild(g);

  // Title bar lives INSIDE the frame at the top edge.
  const titleBg = new Graphics();
  titleBg.rect(-halfW, -halfH, size.width, TITLE_HEIGHT);
  titleBg.fill({ color: stroke, alpha: 0.18 });
  container.addChild(titleBg);

  const txt = new Text({
    text: title,
    style: new TextStyle({
      fontSize: 13,
      fontWeight: '600',
      fill: 0x475569,
    }),
  });
  txt.anchor.set(0, 0.5);
  txt.position.set(-halfW + 12, -halfH + TITLE_HEIGHT / 2);
  container.addChild(txt);

  (container as any).__inlineEditor = {
    field: 'title',
    multiline: false,
    fontSize: 13,
    padding: 4,
    bounds: { x: -halfW, y: -halfH, width: size.width, height: TITLE_HEIGHT },
    color: '#475569',
    // The title bar is a translucent slate-200 strip; using the same color
    // verbatim wouldn't be opaque enough for an HTML input, so we use the
    // solid hex sibling instead.
    background: '#e2e8f0',
  };

  return container;
};
