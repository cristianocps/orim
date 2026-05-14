import { Palette, Maximize, AlignCenter } from 'lucide-react';
import type { ContextActionProvider, ContextAction } from '../types.js';

const STICKY_COLORS = [
  { name: 'Amarelo', value: 0xfde68a },
  { name: 'Rosa', value: 0xfecaca },
  { name: 'Verde', value: 0xa7f3d0 },
  { name: 'Azul', value: 0xbfdbfe },
  { name: 'Roxo', value: 0xddd6fe },
  { name: 'Laranja', value: 0xfed7aa },
  { name: 'Cinza', value: 0xe2e8f0 },
  { name: 'Branco', value: 0xffffff },
];

const SIZES = [
  { id: 'S', size: { width: 140, height: 140 } },
  { id: 'M', size: { width: 180, height: 180 } },
  { id: 'L', size: { width: 240, height: 240 } },
];

export const stickyProvider: ContextActionProvider = {
  id: 'sticky',
  types: ['sticky_note'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'sticky_note') return [];
    // `Edit text` action comes from textFormatProvider — registering another
    // here would render two pencil buttons in the floating toolbar (different
    // ids = different actions to the registry).
    const actions: ContextAction[] = [
      {
        id: 'sticky.color',
        label: 'Cor',
        icon: Palette,
        group: 'style',
        children: () =>
          STICKY_COLORS.map((c) => ({
            id: `sticky.color.${c.value}`,
            label: c.name,
            group: 'style',
            isToggled: () => (primary.style?.fill as number) === c.value,
            run: () => store.updateElement(primary.id, { style: { ...primary.style, fill: c.value } }),
          })),
      },
      {
        id: 'sticky.size',
        label: 'Tamanho',
        icon: Maximize,
        group: 'style',
        children: () =>
          SIZES.map((s) => ({
            id: `sticky.size.${s.id}`,
            label: s.id,
            group: 'style',
            run: () => store.updateElement(primary.id, { size: s.size } as any),
          })),
      },
      {
        id: 'sticky.transform',
        label: 'Transformar em',
        icon: AlignCenter,
        group: 'style',
        children: () => [
          {
            id: 'sticky.toCard',
            label: 'Card',
            group: 'style',
            run: () => {
              // Sticky text now lives in a child text element, not on
              // the sticky itself. We could move/reparent the child to
              // become the card's title, but for v1 we just convert the
              // shape (children will retain their parentId reference and
              // continue rendering inside the new card body).
              store.updateElement(primary.id, {
                type: 'card',
                status: 'todo',
                priority: 'medium',
                tags: [],
                size: { width: 260, height: 160 },
              } as any);
            },
          },
          {
            id: 'sticky.toText',
            label: 'Texto',
            group: 'style',
            run: () => {
              const child = store.getChildren(primary.id).find((c) => c.type === 'text');
              const text = (child as any)?.text ?? '';
              store.updateElement(primary.id, {
                type: 'text',
                text,
                fontSize: 18,
              } as any);
            },
          },
        ],
      },
    ];
    return actions;
  },
  properties: ({ primary, patch, store }) => {
    if (!primary || primary.type !== 'sticky_note') return [];
    const textChild = store.getChildren(primary.id).find((c) => c.type === 'text');
    return [
      {
        id: 'sticky.text',
        label: 'Texto',
        type: 'textarea',
        group: 'content',
        get: () => (textChild as any)?.text ?? '',
        set: (_, v) => {
          if (textChild) patch(textChild.id, { text: String(v) } as any);
        },
      },
      {
        id: 'sticky.fontSize',
        label: 'Tamanho da fonte',
        type: 'slider',
        min: 10,
        max: 48,
        step: 1,
        group: 'appearance',
        get: () => (primary.style?.fontSize as number) ?? 16,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, fontSize: Number(v) } }),
      },
      {
        id: 'sticky.color',
        label: 'Cor',
        type: 'color',
        group: 'appearance',
        get: () => (primary.style?.fill as number) ?? 0xfde68a,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, fill: Number(v) } }),
      },
      {
        id: 'sticky.width',
        label: 'Largura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.width as number) ?? 180,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: Number(v),
              height: (primary as any).size?.height ?? 180,
            },
          } as any),
      },
      {
        id: 'sticky.height',
        label: 'Altura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.height as number) ?? 180,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: (primary as any).size?.width ?? 180,
              height: Number(v),
            },
          } as any),
      },
    ];
  },
};
