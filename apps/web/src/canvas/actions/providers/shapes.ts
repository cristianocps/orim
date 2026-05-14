import { Palette, Square, Circle as CircleIcon } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

const FILL_COLORS = [0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x8b5cf6, 0xd946ef, 0x06b6d4, 0x1e293b, 0xffffff];
const STROKE_COLORS = [0x1e293b, 0x475569, 0xef4444, 0x10b981, 0x3b82f6, 0xffffff];

export const shapeProvider: ContextActionProvider = {
  id: 'shape',
  types: ['rectangle', 'circle', 'ellipse', 'line', 'arrow'],
  // The "Edit text" pencil + bold/italic/align/size/color come from
  // textFormatProvider so any text-bearing element gets the same controls.
  // This provider focuses on shape-only options (fill, stroke, transform).
  actions: ({ primary, store }) => {
    if (!primary) return [];
    const styleObj = primary.style ?? {};
    return [
      {
        id: 'shape.fill',
        label: 'Cor de preenchimento',
        icon: Palette,
        group: 'style',
        children: () =>
          FILL_COLORS.map((c) => ({
            id: `shape.fill.${c}`,
            label: `#${c.toString(16).padStart(6, '0')}`,
            group: 'style',
            isToggled: () => (styleObj.fill as number) === c,
            run: () => store.updateElement(primary.id, { style: { ...styleObj, fill: c } }),
          })),
      },
      {
        id: 'shape.stroke',
        label: 'Cor da borda',
        icon: Square,
        group: 'style',
        children: () =>
          STROKE_COLORS.map((c) => ({
            id: `shape.stroke.${c}`,
            label: `#${c.toString(16).padStart(6, '0')}`,
            group: 'style',
            isToggled: () => (styleObj.stroke as number) === c,
            run: () => store.updateElement(primary.id, { style: { ...styleObj, stroke: c } }),
          })),
      },
      {
        id: 'shape.toCircle',
        label: 'Transformar em',
        icon: CircleIcon,
        group: 'style',
        children: () => [
          {
            id: 'shape.toRect',
            label: 'Retângulo',
            group: 'style',
            run: () =>
              store.updateElement(primary.id, {
                type: 'rectangle',
                size: { width: 160, height: 100 },
              } as any),
          },
          {
            id: 'shape.toCircle',
            label: 'Círculo',
            group: 'style',
            run: () => store.updateElement(primary.id, { type: 'circle', radius: 50 } as any),
          },
        ],
      },
    ];
  },
  properties: ({ primary, patch }) => {
    if (!primary) return [];
    const baseStyle = primary.style ?? {};
    const fields = [
      {
        id: 'shape.fill',
        label: 'Preenchimento',
        type: 'color' as const,
        group: 'appearance' as const,
        get: () => (baseStyle.fill as number) ?? 0x3b82f6,
        set: (_: unknown, v: unknown) =>
          patch(primary.id, { style: { ...baseStyle, fill: Number(v) } }),
      },
      {
        id: 'shape.stroke',
        label: 'Borda',
        type: 'color' as const,
        group: 'appearance' as const,
        get: () => (baseStyle.stroke as number) ?? 0x1e293b,
        set: (_: unknown, v: unknown) =>
          patch(primary.id, { style: { ...baseStyle, stroke: Number(v) } }),
      },
      {
        id: 'shape.strokeWidth',
        label: 'Espessura',
        type: 'slider' as const,
        min: 0,
        max: 10,
        step: 1,
        group: 'appearance' as const,
        get: () => (baseStyle.strokeWidth as number) ?? 2,
        set: (_: unknown, v: unknown) =>
          patch(primary.id, { style: { ...baseStyle, strokeWidth: Number(v) } }),
      },
      {
        id: 'shape.opacity',
        label: 'Opacidade',
        type: 'slider' as const,
        min: 0,
        max: 1,
        step: 0.05,
        group: 'appearance' as const,
        get: () => (baseStyle.opacity as number) ?? 1,
        set: (_: unknown, v: unknown) =>
          patch(primary.id, { style: { ...baseStyle, opacity: Number(v) } }),
      },
    ];
    if (primary.type === 'rectangle') {
      fields.push({
        id: 'shape.cornerRadius',
        label: 'Raio dos cantos',
        type: 'slider' as const,
        min: 0,
        max: 40,
        step: 1,
        group: 'appearance' as const,
        get: () => (baseStyle.cornerRadius as number) ?? 8,
        set: (_, v) =>
          patch(primary.id, { style: { ...baseStyle, cornerRadius: Number(v) } }),
      });
    }
    return fields;
  },
};
