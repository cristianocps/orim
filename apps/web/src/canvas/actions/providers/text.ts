import { Bold, Italic, AlignLeft, AlignCenter, AlignRight, Pencil, Palette } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

const FONT_FAMILIES = [
  'Inter, system-ui, sans-serif',
  'ui-monospace, SFMono-Regular, Menlo, monospace',
  'Georgia, serif',
];

const COLORS = [0x1e293b, 0x0f172a, 0xef4444, 0x10b981, 0x3b82f6, 0xf59e0b, 0x8b5cf6, 0xffffff];

export const textProvider: ContextActionProvider = {
  id: 'text',
  types: ['text'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'text') return [];
    const styleObj = primary.style ?? {};
    const isBold = styleObj.fontWeight === '700' || styleObj.fontWeight === 'bold';
    const isItalic = styleObj.fontStyle === 'italic';
    const align = (styleObj.align as string) ?? 'left';
    return [
      {
        id: 'text.edit',
        label: 'Editar',
        icon: Pencil,
        shortcut: 'Enter',
        group: 'content',
        run: ({ engine }) => engine.beginInlineEdit(primary.id),
      },
      {
        id: 'text.bold',
        label: 'Negrito',
        icon: Bold,
        group: 'style',
        isToggled: () => isBold,
        run: () =>
          store.updateElement(primary.id, {
            style: { ...styleObj, fontWeight: isBold ? '500' : '700' },
          }),
      },
      {
        id: 'text.italic',
        label: 'Itálico',
        icon: Italic,
        group: 'style',
        isToggled: () => isItalic,
        run: () =>
          store.updateElement(primary.id, {
            style: { ...styleObj, fontStyle: isItalic ? 'normal' : 'italic' },
          }),
      },
      {
        id: 'text.align.left',
        label: 'Alinhar à esquerda',
        icon: AlignLeft,
        group: 'style',
        isToggled: () => align === 'left',
        run: () => store.updateElement(primary.id, { style: { ...styleObj, align: 'left' } }),
      },
      {
        id: 'text.align.center',
        label: 'Centralizar',
        icon: AlignCenter,
        group: 'style',
        isToggled: () => align === 'center',
        run: () => store.updateElement(primary.id, { style: { ...styleObj, align: 'center' } }),
      },
      {
        id: 'text.align.right',
        label: 'Alinhar à direita',
        icon: AlignRight,
        group: 'style',
        isToggled: () => align === 'right',
        run: () => store.updateElement(primary.id, { style: { ...styleObj, align: 'right' } }),
      },
      {
        id: 'text.color',
        label: 'Cor',
        icon: Palette,
        group: 'style',
        children: () =>
          COLORS.map((c) => ({
            id: `text.color.${c}`,
            label: `#${c.toString(16).padStart(6, '0')}`,
            group: 'style',
            isToggled: () => (styleObj.color as number) === c,
            run: () => store.updateElement(primary.id, { style: { ...styleObj, color: c } }),
          })),
      },
    ];
  },
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
