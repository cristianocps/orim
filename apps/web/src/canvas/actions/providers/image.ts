import { Replace, RotateCw, FlipHorizontal2, Link2 } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

export const imageProvider: ContextActionProvider = {
  id: 'image',
  types: ['image'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'image') return [];
    return [
      {
        id: 'image.replace',
        label: 'Substituir',
        icon: Replace,
        group: 'image',
        run: () => {
          const input = document.createElement('input');
          input.type = 'file';
          input.accept = 'image/*';
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) return;
            const formData = new FormData();
            formData.append('file', file);
            try {
              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
                credentials: 'include',
              });
              const data = await res.json();
              if (data.url) {
                store.updateElement(primary.id, { url: data.url } as any);
              }
            } catch {
              // ignore failures
            }
          };
          input.click();
        },
      },
      {
        id: 'image.rotate',
        label: 'Girar 90°',
        icon: RotateCw,
        group: 'image',
        run: () => {
          const t = primary.transform;
          store.updateElement(primary.id, {
            transform: { ...t, rotation: (t.rotation + Math.PI / 2) % (Math.PI * 2) },
          });
        },
      },
      {
        id: 'image.flip',
        label: 'Espelhar',
        icon: FlipHorizontal2,
        group: 'image',
        run: () => {
          const t = primary.transform;
          store.updateElement(primary.id, { transform: { ...t, scaleX: -t.scaleX } });
        },
      },
      {
        id: 'image.copyUrl',
        label: 'Copiar URL',
        icon: Link2,
        group: 'image',
        run: () => {
          const url = (primary as any).url;
          if (url && navigator.clipboard) navigator.clipboard.writeText(url).catch(() => {});
        },
      },
    ];
  },
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'image') return [];
    return [
      {
        id: 'image.alt',
        label: 'Texto alternativo',
        type: 'text',
        group: 'content',
        get: () => (primary as any).alt ?? '',
        set: (_, v) => patch(primary.id, { alt: String(v) } as any),
      },
      {
        id: 'image.width',
        label: 'Largura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.width as number) ?? 240,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: Number(v),
              height: (primary as any).size?.height ?? 180,
            },
          } as any),
      },
      {
        id: 'image.height',
        label: 'Altura',
        type: 'number',
        group: 'layout',
        get: () => ((primary as any).size?.height as number) ?? 180,
        set: (_, v) =>
          patch(primary.id, {
            size: {
              width: (primary as any).size?.width ?? 240,
              height: Number(v),
            },
          } as any),
      },
      {
        id: 'image.opacity',
        label: 'Opacidade',
        type: 'slider',
        min: 0,
        max: 1,
        step: 0.05,
        group: 'appearance',
        get: () => (primary.style?.opacity as number) ?? 1,
        set: (_, v) => patch(primary.id, { style: { ...primary.style, opacity: Number(v) } }),
      },
    ];
  },
};
