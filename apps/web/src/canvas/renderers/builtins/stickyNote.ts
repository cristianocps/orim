import { Container, Graphics } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

/**
 * Renders ONLY the paper (shadow + filled rectangle). The note's textual
 * content lives in a child `text` element parented to this sticky_note —
 * see `insertElementAt('sticky_note')` in the engine, which creates the
 * pair atomically. This split was made so every shape with editable text
 * shares the same single text renderer, and so inline editing,
 * formatting, and font handling have only one code path to maintain.
 *
 * The sticky_note no longer exposes an `__inlineEditor` descriptor of
 * its own. Double-clicking the note runs through the engine's
 * `tryBeginInlineEdit`, which finds the child text descendant and opens
 * THAT editor — the user's experience is identical to the old behavior,
 * but the source of truth for text + formatting is now a real text
 * element (so the format toolbar's `style.fontWeight`, `style.color`,
 * etc. operate on the same node Pixi paints).
 */
export const renderStickyNote: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 180, height: 180 };
  const fill = (el.style?.fill as number) ?? 0xfde68a;

  const shadow = new Graphics();
  shadow.rect(-size.width / 2 + 4, -size.height / 2 + 6, size.width, size.height);
  shadow.fill({ color: 0x000000, alpha: 0.08 });
  container.addChild(shadow);

  const paper = new Graphics();
  paper.rect(-size.width / 2, -size.height / 2, size.width, size.height);
  paper.fill({ color: fill });
  container.addChild(paper);

  return container;
};
