import { Spline, MoveRight, ArrowRight, Slash, Palette, Type as TypeIcon } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';
import type { ConnectorElement } from '@orim/shared';

const STROKE_COLORS = [0x475569, 0x1e293b, 0xef4444, 0x10b981, 0x3b82f6, 0xf59e0b, 0x8b5cf6];

export const connectorProvider: ContextActionProvider = {
  id: 'connector',
  types: ['connector'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'connector') return [];
    const c = primary as ConnectorElement;
    return [
      {
        id: 'connector.style',
        label: 'Tipo de linha',
        icon: Spline,
        group: 'connector',
        children: () =>
          (['straight', 'curved', 'elbow'] as const).map((s) => ({
            id: `connector.style.${s}`,
            label:
              s === 'straight'
                ? 'Reta'
                : s === 'curved'
                  ? 'Curva'
                  : 'Cotovelo',
            group: 'connector',
            isToggled: () => c.styleType === s,
            run: () => store.updateElement(primary.id, { styleType: s } as any),
          })),
      },
      {
        id: 'connector.lineStyle',
        label: 'Estilo da linha',
        icon: Slash,
        group: 'connector',
        children: () =>
          (['solid', 'dashed', 'dotted'] as const).map((s) => ({
            id: `connector.lineStyle.${s}`,
            label: s === 'solid' ? 'Sólida' : s === 'dashed' ? 'Tracejada' : 'Pontilhada',
            group: 'connector',
            isToggled: () => (c.lineStyle ?? 'solid') === s,
            run: () => store.updateElement(primary.id, { lineStyle: s } as any),
          })),
      },
      {
        id: 'connector.arrows',
        label: 'Setas',
        icon: ArrowRight,
        group: 'connector',
        children: () => {
          const arrows = ['none', 'triangle', 'diamond', 'circle'] as const;
          return [
            ...arrows.map((a) => ({
              id: `connector.arrowEnd.${a}`,
              label: `Final: ${a}`,
              group: 'connector' as const,
              isToggled: () => (c.arrowEnd ?? 'triangle') === a,
              run: () => store.updateElement(primary.id, { arrowEnd: a } as any),
            })),
            ...arrows.map((a) => ({
              id: `connector.arrowStart.${a}`,
              label: `Início: ${a}`,
              group: 'connector' as const,
              isToggled: () => (c.arrowStart ?? 'none') === a,
              run: () => store.updateElement(primary.id, { arrowStart: a } as any),
            })),
          ];
        },
      },
      {
        id: 'connector.color',
        label: 'Cor',
        icon: Palette,
        group: 'connector',
        children: () =>
          STROKE_COLORS.map((color) => ({
            id: `connector.color.${color}`,
            label: `#${color.toString(16).padStart(6, '0')}`,
            group: 'connector',
            isToggled: () => (c.strokeColor ?? 0x475569) === color,
            run: () => store.updateElement(primary.id, { strokeColor: color } as any),
          })),
      },
      {
        id: 'connector.label',
        label: 'Label',
        icon: TypeIcon,
        group: 'connector',
        run: () => {
          const value = window.prompt('Texto do conector', c.label ?? '');
          if (value === null) return;
          store.updateElement(primary.id, { label: value } as any);
        },
      },
      {
        id: 'connector.preset',
        label: 'Estilo rápido',
        icon: MoveRight,
        group: 'connector',
        children: () => [
          {
            id: 'connector.preset.flow',
            label: 'Fluxo (azul curvo)',
            group: 'connector',
            run: () =>
              store.updateElement(primary.id, {
                styleType: 'curved',
                lineStyle: 'solid',
                strokeColor: 0x3b82f6,
                strokeWidth: 2,
                arrowEnd: 'triangle',
              } as any),
          },
          {
            id: 'connector.preset.dependency',
            label: 'Dependência (vermelha tracejada)',
            group: 'connector',
            run: () =>
              store.updateElement(primary.id, {
                styleType: 'elbow',
                lineStyle: 'dashed',
                strokeColor: 0xef4444,
                strokeWidth: 2,
                arrowEnd: 'triangle',
              } as any),
          },
          {
            id: 'connector.preset.note',
            label: 'Anotação (cinza fina)',
            group: 'connector',
            run: () =>
              store.updateElement(primary.id, {
                styleType: 'straight',
                lineStyle: 'dotted',
                strokeColor: 0x94a3b8,
                strokeWidth: 1,
                arrowEnd: 'none',
              } as any),
          },
        ],
      },
    ];
  },
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'connector') return [];
    const c = primary as ConnectorElement;
    return [
      {
        id: 'connector.styleType',
        label: 'Tipo',
        type: 'select',
        group: 'appearance',
        options: [
          { value: 'straight', label: 'Reta' },
          { value: 'curved', label: 'Curva' },
          { value: 'elbow', label: 'Cotovelo' },
        ],
        get: () => c.styleType ?? 'curved',
        set: (_, v) => patch(primary.id, { styleType: String(v) } as any),
      },
      {
        id: 'connector.lineStyle',
        label: 'Estilo',
        type: 'select',
        group: 'appearance',
        options: [
          { value: 'solid', label: 'Sólida' },
          { value: 'dashed', label: 'Tracejada' },
          { value: 'dotted', label: 'Pontilhada' },
        ],
        get: () => c.lineStyle ?? 'solid',
        set: (_, v) => patch(primary.id, { lineStyle: String(v) } as any),
      },
      {
        id: 'connector.color',
        label: 'Cor',
        type: 'color',
        group: 'appearance',
        get: () => c.strokeColor ?? 0x475569,
        set: (_, v) => patch(primary.id, { strokeColor: Number(v) } as any),
      },
      {
        id: 'connector.width',
        label: 'Espessura',
        type: 'slider',
        min: 1,
        max: 8,
        step: 1,
        group: 'appearance',
        get: () => c.strokeWidth ?? 2,
        set: (_, v) => patch(primary.id, { strokeWidth: Number(v) } as any),
      },
      {
        id: 'connector.arrowStart',
        label: 'Seta inicial',
        type: 'select',
        group: 'appearance',
        options: [
          { value: 'none', label: 'Nenhuma' },
          { value: 'triangle', label: 'Triângulo' },
          { value: 'diamond', label: 'Losango' },
          { value: 'circle', label: 'Círculo' },
        ],
        get: () => c.arrowStart ?? 'none',
        set: (_, v) => patch(primary.id, { arrowStart: String(v) } as any),
      },
      {
        id: 'connector.arrowEnd',
        label: 'Seta final',
        type: 'select',
        group: 'appearance',
        options: [
          { value: 'none', label: 'Nenhuma' },
          { value: 'triangle', label: 'Triângulo' },
          { value: 'diamond', label: 'Losango' },
          { value: 'circle', label: 'Círculo' },
        ],
        get: () => c.arrowEnd ?? 'triangle',
        set: (_, v) => patch(primary.id, { arrowEnd: String(v) } as any),
      },
      {
        id: 'connector.label',
        label: 'Label',
        type: 'text',
        group: 'content',
        get: () => c.label ?? '',
        set: (_, v) => patch(primary.id, { label: String(v) } as any),
      },
    ];
  },
};
