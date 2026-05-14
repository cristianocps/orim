import { Pencil, Frame as FrameIcon, Presentation } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

const FRAME_PRESETS = [
  { id: '16-9', label: '16:9 Apresentação', size: { width: 960, height: 540 } },
  { id: 'a4', label: 'A4 Retrato', size: { width: 595, height: 842 } },
  { id: 'a4l', label: 'A4 Paisagem', size: { width: 842, height: 595 } },
  { id: 'mobile', label: 'Mobile', size: { width: 375, height: 667 } },
  { id: 'square', label: 'Quadrado', size: { width: 600, height: 600 } },
];

export const frameProvider: ContextActionProvider = {
  id: 'frame',
  types: ['frame'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'frame') return [];
    const titleChild = store.getChildren(primary.id).find((c) => c.type === 'text');
    return [
      {
        id: 'frame.rename',
        label: 'Renomear',
        icon: Pencil,
        shortcut: 'Enter',
        group: 'content',
        run: ({ engine }) => {
          if (!titleChild) return;
          store.setSelectedIds([titleChild.id]);
          engine.beginInlineEdit(titleChild.id);
        },
      },
      {
        id: 'frame.preset',
        label: 'Tamanho',
        icon: FrameIcon,
        group: 'frame',
        children: () =>
          FRAME_PRESETS.map((p) => ({
            id: `frame.preset.${p.id}`,
            label: p.label,
            group: 'frame',
            run: () => store.updateElement(primary.id, { size: p.size } as any),
          })),
      },
      {
        id: 'frame.present',
        label: 'Apresentar',
        icon: Presentation,
        group: 'frame',
        run: () => {
          window.dispatchEvent(new CustomEvent('orim:presentFrame', { detail: { id: primary.id } }));
        },
      },
    ];
  },
  properties: ({ primary, patch, store }) => {
    if (!primary || primary.type !== 'frame') return [];
    const titleChild = store.getChildren(primary.id).find((c) => c.type === 'text');
    return [
      {
        id: 'frame.title',
        label: 'Título',
        type: 'text',
        group: 'content',
        get: () => (titleChild as any)?.text ?? '',
        set: (_, v) => {
          if (titleChild) patch(titleChild.id, { text: String(v) } as any);
        },
      },
      {
        id: 'frame.width',
        label: 'Largura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.width as number) ?? 600,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: Number(v),
              height: (primary as any).size?.height ?? 400,
            },
          } as any),
      },
      {
        id: 'frame.height',
        label: 'Altura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.height as number) ?? 400,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: (primary as any).size?.width ?? 600,
              height: Number(v),
            },
          } as any),
      },
      {
        id: 'frame.fill',
        label: 'Cor de fundo',
        type: 'color',
        group: 'appearance',
        get: () => (primary.style?.fill as number) ?? 0xffffff,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, fill: Number(v) } }),
      },
    ];
  },
};
