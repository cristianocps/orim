import { Container, Graphics, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';
import type { AnchorDescriptor } from '../../connectors.js';

export const renderTable: ElementRenderer = (el) => {
  const container = new Container();
  const rows = (el as any).rows ?? 3;
  const cols = (el as any).cols ?? 3;
  const cells = (el as any).cells ?? [];
  const colWidths: number[] = (el as any).colWidths ?? Array(cols).fill(120);
  const rowHeights: number[] = (el as any).rowHeights ?? Array(rows).fill(36);
  const headerRow = (el as any).headerRow ?? false;

  const totalW = colWidths.reduce((a, b) => a + b, 0);
  const totalH = rowHeights.reduce((a, b) => a + b, 0);
  const startX = -totalW / 2;
  const startY = -totalH / 2;

  const bg = new Graphics();
  bg.rect(startX, startY, totalW, totalH);
  bg.fill({ color: 0xffffff });
  container.addChild(bg);

  if (headerRow) {
    const header = new Graphics();
    header.rect(startX, startY, totalW, rowHeights[0]);
    header.fill({ color: 0xf1f5f9 });
    container.addChild(header);
  }

  const grid = new Graphics();
  let x = startX;
  for (let c = 0; c <= cols; c++) {
    grid.moveTo(x, startY);
    grid.lineTo(x, startY + totalH);
    if (c < cols) x += colWidths[c];
  }
  let y = startY;
  for (let r = 0; r <= rows; r++) {
    grid.moveTo(startX, y);
    grid.lineTo(startX + totalW, y);
    if (r < rows) y += rowHeights[r];
  }
  grid.stroke({ width: 1, color: 0xe2e8f0 });

  // Outer border
  grid.rect(startX, startY, totalW, totalH);
  grid.stroke({ width: 1.5, color: 0xcbd5e1 });
  container.addChild(grid);

  for (let r = 0; r < rows; r++) {
    let cx = startX;
    let rowOffset = 0;
    for (let i = 0; i < r; i++) rowOffset += rowHeights[i];
    for (let c = 0; c < cols; c++) {
      const cell = cells[r]?.[c] as { text?: string; backgroundColor?: number; align?: 'left' | 'center' | 'right' } | undefined;
      if (cell?.backgroundColor !== undefined) {
        const cellBg = new Graphics();
        cellBg.rect(cx + 0.5, startY + rowOffset + 0.5, colWidths[c] - 1, rowHeights[r] - 1);
        cellBg.fill({ color: cell.backgroundColor });
        container.addChild(cellBg);
      }
      if (cell?.text) {
        const txt = new Text({
          text: String(cell.text),
          style: new TextStyle({
            fontSize: 12,
            fill: r === 0 && headerRow ? 0x475569 : 0x1e293b,
            fontWeight: r === 0 && headerRow ? '600' : '400',
            wordWrap: true,
            wordWrapWidth: colWidths[c] - 16,
          }),
        });
        const align = cell.align ?? 'left';
        if (align === 'center') {
          txt.anchor.set(0.5, 0.5);
          txt.position.set(cx + colWidths[c] / 2, startY + rowOffset + rowHeights[r] / 2);
        } else if (align === 'right') {
          txt.anchor.set(1, 0.5);
          txt.position.set(cx + colWidths[c] - 8, startY + rowOffset + rowHeights[r] / 2);
        } else {
          txt.anchor.set(0, 0.5);
          txt.position.set(cx + 8, startY + rowOffset + rowHeights[r] / 2);
        }
        container.addChild(txt);
      }
      cx += colWidths[c];
    }
  }

  // Per-cell anchors for connectors (4 sides + 4 corners + center)
  (container as any).__getAnchors = (): AnchorDescriptor[] => [
    { id: 'top', nx: 0, ny: -0.5 },
    { id: 'right', nx: 0.5, ny: 0 },
    { id: 'bottom', nx: 0, ny: 0.5 },
    { id: 'left', nx: -0.5, ny: 0 },
    { id: 'top-left', nx: -0.5, ny: -0.5 },
    { id: 'top-right', nx: 0.5, ny: -0.5 },
    { id: 'bottom-right', nx: 0.5, ny: 0.5 },
    { id: 'bottom-left', nx: -0.5, ny: 0.5 },
  ];

  return container;
};
