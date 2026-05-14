import type { ContextActionProvider } from '../types.js';

const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'ui-monospace, SFMono-Regular, Menlo, monospace',
  'Georgia, serif',
];

// Toolbar formatting (bold / italic / align / size / color) is provided by
// the shared `textFormatProvider`. This provider only contributes the
// text-specific PROPERTIES panel fields and the font family selector that
// doesn't apply to other element types.
export const textProvider: ContextActionProvider = {
  id: 'text',
  types: ['text'],
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'text') return [];
    return [
      {
        id: 'text.value',
        label: 'Conteúdo',
        type: 'textarea',
        group: 'content',
        get: () => (primary as any).text ?? '',
        set: (_, v) => patch(primary.id, { text: String(v) } as any),
      },
      {
        id: 'text.fontSize',
        label: 'Tamanho',
        type: 'slider',
        min: 8,
        max: 96,
        step: 1,
        group: 'appearance',
        get: () => (primary as any).fontSize ?? 24,
        set: (_, v) => patch(primary.id, { fontSize: Number(v) } as any),
      },
      {
        id: 'text.color',
        label: 'Cor',
        type: 'color',
        group: 'appearance',
        get: () => (primary.style?.color as number) ?? 0x1e293b,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, color: Number(v) } }),
      },
      {
        id: 'text.font',
        label: 'Fonte',
        type: 'select',
        group: 'appearance',
        options: FONT_FAMILIES.map((f) => ({ value: f, label: f.split(',')[0] })),
        get: () => (primary as any).fontFamily ?? FONT_FAMILIES[0],
        set: (_, v) => patch(primary.id, { fontFamily: String(v) } as any),
      },
    ];
  },
};
