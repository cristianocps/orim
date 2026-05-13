import { Graphics, Container } from 'pixi.js';

export interface StrokePoint {
  x: number;
  y: number;
  pressure?: number;
}

export interface FreehandStroke {
  points: StrokePoint[];
  color: number;
  width: number;
  opacity: number;
  mode: 'pen' | 'highlighter' | 'eraser';
}

export function createStrokeGraphics(stroke: FreehandStroke): Graphics {
  const g = new Graphics();
  if (stroke.points.length < 2) return g;

  const alpha = stroke.mode === 'highlighter' ? 0.3 : stroke.opacity;
  const width = stroke.mode === 'highlighter' ? stroke.width * 3 : stroke.width;

  g.moveTo(stroke.points[0].x, stroke.points[0].y);

  for (let i = 1; i < stroke.points.length; i++) {
    const p = stroke.points[i];
    if (stroke.mode === 'eraser') {
      // Eraser draws white/over background color
      g.lineTo(p.x, p.y);
    } else {
      g.lineTo(p.x, p.y);
    }
  }

  g.stroke({ width, color: stroke.color, alpha });
  return g;
}

export function smoothStroke(points: StrokePoint[]): StrokePoint[] {
  if (points.length < 3) return points;
  const smoothed: StrokePoint[] = [];
  smoothed.push(points[0]);

  for (let i = 1; i < points.length - 1; i++) {
    smoothed.push({
      x: (points[i - 1].x + points[i].x + points[i + 1].x) / 3,
      y: (points[i - 1].y + points[i].y + points[i + 1].y) / 3,
    });
  }

  smoothed.push(points[points.length - 1]);
  return smoothed;
}

export function createStrokeContainer(stroke: FreehandStroke): Container {
  const container = new Container();
  const g = createStrokeGraphics(stroke);
  container.addChild(g);
  return container;
}
