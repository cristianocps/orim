import {
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Type as TypeIcon,
  Palette,
  Pencil,
} from 'lucide-react';
import type { ContextAction, ContextActionProvider } from '../types.js';

// Element types that have a free-form text field the user can format. Card
// (structured title/description) and frame (just a title bar) intentionally
// stay out — their providers expose dedicated content controls.
const TEXT_TYPES = new Set([
  'text',
  'sticky_note',
  'rectangle',
  'circle',
  'ellipse',
]);

const FONT_SIZES = [10, 12, 14, 16, 20, 24, 32, 40, 48, 64];

// Tailwind-ish palette restricted to readable foreground colors. The picker
// is deliberately small to stay one click away in the floating toolbar.
const TEXT_COLORS = [
  0x1e293b,
  0x0f172a,
  0xffffff,
  0xef4444,
  0xf59e0b,
  0x10b981,
  0x3b82f6,
  0x8b5cf6,
  0xec4899,
];

// Actions are reused verbatim across all text-bearing element types — the
// only thing that changes per type is which `style.*` field the renderer
// reads. We keep the provider type-agnostic and rely on the renderers for
// each shape to read these style fields (renderers were updated alongside
// this file). Without the renderer changes, toggling Bold etc. would silently
// no-op visually.
export const textFormatProvider: ContextActionProvider = {
  id: 'text-format',
  types: Array.from(TEXT_TYPES),
  actions: ({ primary, store }) => {
    if (!primary || !TEXT_TYPES.has(primary.type as string)) return [];
    const styleObj = (primary.style ?? {}) as Record<string, unknown>;
    const isBold = styleObj.fontWeight === '700' || styleObj.fontWeight === 'bold';
    const isItalic = styleObj.fontStyle === 'italic';
    const align = (styleObj.align as string) ?? 'center';
    // text element keeps fontSize at the top level (legacy); other element
    // types put it inside style.fontSize. Read both so the toggle reflects
    // the rendered value either way.
    const currentSize = ((primary as any).fontSize as number | undefined)
      ?? (styleObj.fontSize as number | undefined)
      ?? 16;

    const setStyle = (next: Record<string, unknown>) => {
      store.updateElement(primary.id, { style: { ...styleObj, ...next } });
    };

    const setFontSize = (size: number) => {
      // Mirror to BOTH the legacy top-level field AND style so all renderers
      // pick it up regardless of which one they read.
      store.updateElement(primary.id, {
        style: { ...styleObj, fontSize: size },
        fontSize: size,
      } as any);
    };

    const actions: ContextAction[] = [
      {
        id: 'textfmt.edit',
        label: 'Editar texto',
        icon: Pencil,
        shortcut: 'Enter',
        group: 'content',
        run: ({ engine }) => engine.beginInlineEdit(primary.id),
      },
      {
        id: 'textfmt.bold',
        label: 'Negrito',
        icon: Bold,
        group: 'style',
        isToggled: () => isBold,
        run: () => setStyle({ fontWeight: isBold ? '500' : '700' }),
      },
      {
        id: 'textfmt.italic',
        label: 'Itálico',
        icon: Italic,
        group: 'style',
        isToggled: () => isItalic,
        run: () => setStyle({ fontStyle: isItalic ? 'normal' : 'italic' }),
      },
      {
        id: 'textfmt.align.left',
        label: 'Alinhar à esquerda',
        icon: AlignLeft,
        group: 'style',
        isToggled: () => align === 'left',
        run: () => setStyle({ align: 'left' }),
      },
      {
        id: 'textfmt.align.center',
        label: 'Centralizar',
        icon: AlignCenter,
        group: 'style',
        isToggled: () => align === 'center',
        run: () => setStyle({ align: 'center' }),
      },
      {
        id: 'textfmt.align.right',
        label: 'Alinhar à direita',
        icon: AlignRight,
        group: 'style',
        isToggled: () => align === 'right',
        run: () => setStyle({ align: 'right' }),
      },
      {
        id: 'textfmt.size',
        label: 'Tamanho da fonte',
        icon: TypeIcon,
        group: 'style',
        children: () =>
          FONT_SIZES.map((s) => ({
            id: `textfmt.size.${s}`,
            label: `${s} px`,
            group: 'style' as const,
            isToggled: () => Math.round(currentSize) === s,
            run: () => setFontSize(s),
          })),
      },
      {
        id: 'textfmt.color',
        label: 'Cor do texto',
        icon: Palette,
        group: 'style',
        children: () =>
          TEXT_COLORS.map((c) => ({
            id: `textfmt.color.${c}`,
            label: `#${c.toString(16).padStart(6, '0')}`,
            group: 'style' as const,
            isToggled: () => (styleObj.color as number) === c,
            run: () => setStyle({ color: c }),
          })),
      },
    ];
    return actions;
  },
  // Properties are intentionally NOT defined here — per-type providers
  // already expose appearance fields (and they fit the panel's grouping
  // better). This provider focuses on the toolbar surface, where the
  // shared formatting controls add the most value.
};
