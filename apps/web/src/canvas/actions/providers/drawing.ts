import { Palette, Wand2 } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';
import { smoothStroke } from '../../freehand.js';

const COLORS = [0x1e293b, 0xef4444, 0x10b981, 0xf59e0b, 0x3b82f6, 0x8b5cf6, 0xfacc15, 0xffffff];

export const drawingProvider: ContextActionProvider = {
  id: 'drawing',
  types: ['drawing'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'drawing') return [];
    const drawing = primary as any;
    return [
      {
        id: 'drawing.color',
        label: 'Cor',
        icon: Palette,
        group: 'style',
        children: () =>
          COLORS.map((c) => ({
            id: `drawing.color.${c}`,
            label: `#${c.toString(16).padStart(6, '0')}`,
            group: 'style',
            isToggled: () => drawing.color === c,
            run: () => store.updateElement(primary.id, { color: c } as any),
          })),
      },
      {
        id: 'drawing.smooth',
        label: 'Suavizar',
        icon: Wand2,
        group: 'style',
        run: () => {
          let pts = drawing.points ?? [];
          for (let i = 0; i < 2; i++) pts = smoothStroke(pts);
          store.updateElement(primary.id, { points: pts } as any);
        },
      },
    ];
  },
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'drawing') return [];
    const drawing = primary as any;
    return [
      {
        id: 'drawing.color',
        label: 'Cor',
        type: 'color',
        group: 'appearance',
        get: () => drawing.color ?? 0x1e293b,
        set: (_, v) => patch(primary.id, { color: Number(v) } as any),
      },
      {
        id: 'drawing.width',
        label: 'Espessura',
        type: 'slider',
        min: 1,
        max: 24,
        step: 1,
        group: 'appearance',
        get: () => drawing.strokeWidth ?? 2,
        set: (_, v) => patch(primary.id, { strokeWidth: Number(v) } as any),
      },
      {
        id: 'drawing.opacity',
        label: 'Opacidade',
        type: 'slider',
        min: 0.1,
        max: 1,
        step: 0.05,
        group: 'appearance',
        get: () => (primary.style?.opacity as number) ?? 1,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, opacity: Number(v) } }),
      },
    ];
  },
};
