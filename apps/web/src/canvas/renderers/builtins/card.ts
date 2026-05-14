import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

const statusColors: Record<string, number> = {
  todo: 0x94a3b8,
  in_progress: 0x3b82f6,
  done: 0x10b981,
  blocked: 0xef4444,
};

const statusLabels: Record<string, string> = {
  todo: 'A fazer',
  in_progress: 'Em progresso',
  done: 'Concluído',
  blocked: 'Bloqueado',
};

const priorityColors: Record<string, number> = {
  low: 0x94a3b8,
  medium: 0xf59e0b,
  high: 0xef4444,
};

/**
 * Renders the card chrome (background, status badge + label, priority
 * dot, tag chips, assignee avatar). Title and description are now
 * separate child `text` elements parented to this card — the engine
 * positions them at the top (title) and middle (description) when the
 * card is created via `insertElementAt('card')`.
 *
 * This separation lets each text node carry its own formatting (font
 * size, weight, color, bold/italic) through the shared format toolbar
 * and editor, instead of the card duplicating that handling internally.
 */
export const renderCard: ElementRenderer = (el) => {
  const container = new Container();
  const size = (el as any).size ?? { width: 260, height: 160 };
  const status = (el as any).status ?? 'todo';
  const priority = (el as any).priority ?? 'medium';
  const tags: string[] = (el as any).tags ?? [];
  const assignee = (el as any).assignee;

  const g = new Graphics();
  g.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 10);
  g.fill({ color: 0xffffff });
  g.stroke({ width: 1, color: 0xe2e8f0 });
  g.rect(-size.width / 2, -size.height / 2, 4, size.height);
  g.fill({ color: statusColors[status] ?? 0x94a3b8 });
  container.addChild(g);

  const statusBadge = new Graphics();
  const badgeWidth = 90;
  statusBadge.roundRect(-size.width / 2 + 14, -size.height / 2 + 12, badgeWidth, 18, 4);
  statusBadge.fill({ color: statusColors[status] ?? 0x94a3b8, alpha: 0.15 });
  container.addChild(statusBadge);
  const statusTxt = new Text({
    text: statusLabels[status] ?? status,
    style: new TextStyle({ fontSize: 9, fontWeight: '600', fill: statusColors[status] ?? 0x475569 }),
  });
  statusTxt.anchor.set(0, 0.5);
  statusTxt.position.set(-size.width / 2 + 22, -size.height / 2 + 21);
  container.addChild(statusTxt);

  const priorityG = new Graphics();
  priorityG.circle(size.width / 2 - 18, -size.height / 2 + 20, 5);
  priorityG.fill({ color: priorityColors[priority] ?? 0xf59e0b });
  container.addChild(priorityG);

  let tagX = -size.width / 2 + 14;
  tags.slice(0, 3).forEach((tag: string) => {
    const tagG = new Graphics();
    const tagW = tag.length * 6 + 12;
    tagG.roundRect(tagX, size.height / 2 - 22, tagW, 18, 4);
    tagG.fill({ color: 0xf1f5f9 });
    container.addChild(tagG);
    const tagTxt = new Text({
      text: tag,
      style: new TextStyle({ fontSize: 10, fill: 0x475569 }),
    });
    tagTxt.anchor.set(0.5);
    tagTxt.position.set(tagX + tagW / 2, size.height / 2 - 13);
    container.addChild(tagTxt);
    tagX += tagW + 6;
  });

  if (assignee) {
    const avG = new Graphics();
    avG.circle(size.width / 2 - 18, size.height / 2 - 18, 12);
    avG.fill({ color: 0x3b82f6 });
    container.addChild(avG);
    const avTxt = new Text({
      text: assignee.charAt(0).toUpperCase(),
      style: new TextStyle({ fontSize: 11, fontWeight: '700', fill: 0xffffff }),
    });
    avTxt.anchor.set(0.5);
    avTxt.position.set(size.width / 2 - 18, size.height / 2 - 18);
    container.addChild(avTxt);
  }

  return container;
};
