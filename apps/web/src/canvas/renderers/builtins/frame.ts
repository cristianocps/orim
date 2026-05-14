import { Container, Graphics } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

const TITLE_HEIGHT = 26;

/**
 * Pure shape renderer — the title text now lives in a child `text`
 * element parented to the frame. See `stickyNote.ts` for the rationale.
 *
 * The renderer still draws the title-bar BACKGROUND so frames have a
 * recognizable visual chrome; only the text itself is delegated.
 */
export const renderFrame: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 600, height: 400 };
  const fill = (el.style?.fill as number) ?? 0xffffff;
  const stroke = (el.style?.stroke as number) ?? 0x94a3b8;

  const halfW = size.width / 2;
  const halfH = size.height / 2;

  // Frame body (single rect — keeps localBounds == size so resize handles
  // and resize math behave like every other "rect with size" element).
  const g = new Graphics();
  g.rect(-halfW, -halfH, size.width, size.height);
  g.fill({ color: fill, alpha: 0.5 });
  g.stroke({ width: 2, color: stroke, alpha: 0.6 });
  container.addChild(g);

  // Title-bar background only — the title text is a child element.
  const titleBg = new Graphics();
  titleBg.rect(-halfW, -halfH, size.width, TITLE_HEIGHT);
  titleBg.fill({ color: stroke, alpha: 0.18 });
  container.addChild(titleBg);

  return container;
};
