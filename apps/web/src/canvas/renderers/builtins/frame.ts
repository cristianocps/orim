import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderFrame: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 600, height: 400 };
  const title = (el as any).title ?? 'Frame';
  const fill = (el.style?.fill as number) ?? 0xffffff;
  const stroke = (el.style?.stroke as number) ?? 0x94a3b8;

  const g = new Graphics();
  g.rect(-size.width / 2, -size.height / 2, size.width, size.height);
  g.fill({ color: fill, alpha: 0.5 });
  g.stroke({ width: 2, color: stroke, alpha: 0.6 });
  container.addChild(g);

  const titleBg = new Graphics();
  titleBg.rect(-size.width / 2, -size.height / 2 - 28, Math.max(120, title.length * 8 + 24), 26);
  titleBg.fill({ color: stroke, alpha: 0.15 });
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
  txt.position.set(-size.width / 2 + 12, -size.height / 2 - 15);
  container.addChild(txt);

  (container as any).__inlineEditor = {
    field: 'title',
    multiline: false,
    fontSize: 13,
    padding: 4,
    bounds: { x: -size.width / 2, y: -size.height / 2 - 28, width: size.width, height: 26 },
  };

  return container;
};
