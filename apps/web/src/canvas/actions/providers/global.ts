import {
  Copy,
  Lock,
  Unlock,
  Trash2,
  Group,
  Ungroup,
  Layers,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignVerticalJustifyStart,
  AlignVerticalJustifyCenter,
  AlignVerticalJustifyEnd,
  ArrowUpToLine,
  ArrowDownToLine,
  ChevronUp,
  ChevronDown,
  MessageSquarePlus,
  Sparkles,
} from 'lucide-react';
import type { ContextActionProvider, ContextAction } from '../types.js';

const isMultiple = (count: number) => count > 1;

const order: ContextAction[] = [
  {
    id: 'order.front',
    label: 'Trazer para a frente',
    icon: ArrowUpToLine,
    shortcut: '⌘]',
    group: 'order',
    run: ({ engine, primary }) => {
      if (primary) engine.bringToFront(primary.id);
    },
    isAvailable: ({ primary }) => Boolean(primary),
  },
  {
    id: 'order.forward',
    label: 'Avançar uma camada',
    icon: ChevronUp,
    group: 'order',
    run: ({ engine, primary }) => {
      if (primary) engine.bringForward(primary.id);
    },
    isAvailable: ({ primary }) => Boolean(primary),
  },
  {
    id: 'order.backward',
    label: 'Recuar uma camada',
    icon: ChevronDown,
    group: 'order',
    run: ({ engine, primary }) => {
      if (primary) engine.sendBackward(primary.id);
    },
    isAvailable: ({ primary }) => Boolean(primary),
  },
  {
    id: 'order.back',
    label: 'Enviar para trás',
    icon: ArrowDownToLine,
    shortcut: '⌘[',
    group: 'order',
    run: ({ engine, primary }) => {
      if (primary) engine.sendToBack(primary.id);
    },
    isAvailable: ({ primary }) => Boolean(primary),
  },
];

const align: ContextAction[] = [
  {
    id: 'align.left',
    label: 'Alinhar à esquerda',
    icon: AlignLeft,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('left'),
  },
  {
    id: 'align.centerH',
    label: 'Centralizar horizontalmente',
    icon: AlignCenter,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('center-h'),
  },
  {
    id: 'align.right',
    label: 'Alinhar à direita',
    icon: AlignRight,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('right'),
  },
  {
    id: 'align.top',
    label: 'Alinhar ao topo',
    icon: AlignVerticalJustifyStart,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('top'),
  },
  {
    id: 'align.centerV',
    label: 'Centralizar verticalmente',
    icon: AlignVerticalJustifyCenter,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('center-v'),
  },
  {
    id: 'align.bottom',
    label: 'Alinhar à base',
    icon: AlignVerticalJustifyEnd,
    group: 'align',
    isAvailable: ({ selection }) => isMultiple(selection.length),
    run: ({ engine }) => engine.alignSelection('bottom'),
  },
];

export const globalActionsProvider: ContextActionProvider = {
  id: 'global',
  types: [],
  actions: () => [
    {
      id: 'common.duplicate',
      label: 'Duplicar',
      icon: Copy,
      shortcut: '⌘D',
      group: 'common',
      run: ({ engine, store, selection }) => {
        const ids: string[] = [];
        for (const el of selection) {
          const cloned = engine.duplicateElement(el.id);
          if (cloned) {
            store.addElement(cloned);
            ids.push(cloned.id);
          }
        }
        if (ids.length > 0) {
          engine.setSelection(ids);
          store.setSelectedIds(ids);
        }
      },
      isAvailable: ({ selection }) => selection.length > 0,
    },
    {
      id: 'common.lock',
      label: 'Bloquear',
      icon: Lock,
      shortcut: '⌘L',
      group: 'common',
      isAvailable: ({ selection }) => selection.some((el) => !el.metadata?.locked),
      isToggled: ({ selection }) => selection.every((el) => Boolean(el.metadata?.locked)),
      run: ({ store, selection }) => {
        const allLocked = selection.every((el) => Boolean(el.metadata?.locked));
        for (const el of selection) {
          store.updateElement(el.id, {
            metadata: { ...el.metadata, locked: !allLocked },
          });
        }
      },
    },
    {
      id: 'common.unlock',
      label: 'Desbloquear',
      icon: Unlock,
      group: 'common',
      isAvailable: ({ selection }) => selection.length > 0 && selection.every((el) => Boolean(el.metadata?.locked)),
      run: ({ store, selection }) => {
        for (const el of selection) {
          store.updateElement(el.id, { metadata: { ...el.metadata, locked: false } });
        }
      },
    },
    {
      id: 'common.group',
      label: 'Agrupar',
      icon: Group,
      shortcut: '⌘G',
      group: 'common',
      isAvailable: ({ selection }) => selection.length > 1,
      run: ({ engine, store, selection }) => {
        const groupId = engine.groupSelection();
        if (!groupId) return;
        for (const el of selection) {
          store.updateElement(el.id, { metadata: { ...el.metadata, groupId } });
        }
      },
    },
    {
      id: 'common.ungroup',
      label: 'Desagrupar',
      icon: Ungroup,
      shortcut: '⇧⌘G',
      group: 'common',
      isAvailable: ({ selection }) => selection.some((el) => Boolean(el.metadata?.groupId)),
      run: ({ engine, store, selection }) => {
        engine.ungroupSelection();
        for (const el of selection) {
          store.updateElement(el.id, { metadata: { ...el.metadata, groupId: null } });
        }
      },
    },
    {
      id: 'common.comment',
      label: 'Comentar',
      icon: MessageSquarePlus,
      group: 'common',
      run: () => {
        // emit('addComment') if needed; left as placeholder for comments wiring
      },
    },
    {
      id: 'common.ai',
      label: 'IA',
      icon: Sparkles,
      group: 'ai',
      run: () => {
        window.dispatchEvent(new CustomEvent('orim:openAI', { detail: {} }));
      },
    },
    ...order,
    ...align,
    {
      id: 'common.delete',
      label: 'Excluir',
      icon: Trash2,
      shortcut: 'Del',
      group: 'danger',
      isAvailable: ({ selection }) => selection.length > 0,
      run: ({ store, selection }) => {
        for (const el of selection) {
          store.removeElement(el.id);
        }
      },
    },
  ],
  properties: ({ primary }) => {
    if (!primary) return [];
    return [
      {
        id: 'transform.x',
        label: 'X',
        type: 'number',
        group: 'layout',
        get: () => Math.round(primary.transform.x),
        set: ({ patch }, value) => {
          patch(primary.id, { transform: { ...primary.transform, x: Number(value) } });
        },
      },
      {
        id: 'transform.y',
        label: 'Y',
        type: 'number',
        group: 'layout',
        get: () => Math.round(primary.transform.y),
        set: ({ patch }, value) => {
          patch(primary.id, { transform: { ...primary.transform, y: Number(value) } });
        },
      },
      {
        id: 'metadata.locked',
        label: 'Bloqueado',
        type: 'toggle',
        group: 'advanced',
        get: () => Boolean(primary.metadata?.locked),
        set: ({ patch }, value) => {
          patch(primary.id, { metadata: { ...primary.metadata, locked: Boolean(value) } });
        },
      },
    ];
  },
};

export const layerOrderProvider: ContextActionProvider = {
  id: 'layer-order',
  types: [],
  actions: () => [],
  properties: ({ primary }) => {
    if (!primary) return [];
    return [
      {
        id: 'layer',
        label: 'Camadas',
        type: 'custom',
        group: 'layout',
        get: () => primary.id,
        set: () => {},
        render: () => null,
        isAvailable: () => false,
      },
    ];
  },
};

void Layers;
