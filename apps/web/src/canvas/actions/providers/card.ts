import { CheckCircle2, Flag, Tag, User, Pencil, FileText } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';
import type { CanvasElement } from '@orim/shared';

const STATUSES = [
  { value: 'todo', label: 'A fazer' },
  { value: 'in_progress', label: 'Em progresso' },
  { value: 'done', label: 'Concluído' },
  { value: 'blocked', label: 'Bloqueado' },
] as const;

const PRIORITIES = [
  { value: 'low', label: 'Baixa' },
  { value: 'medium', label: 'Média' },
  { value: 'high', label: 'Alta' },
] as const;

/**
 * Card title and description used to be inline string fields on the card
 * element. They're now child `text` elements (positions 0 and 1 in
 * creation order — see `insertElementAt('card')` in the engine). This
 * provider delegates reads/writes to those children: editor actions
 * select+edit the right child, and the properties panel reads/patches
 * the child's `.text` field directly.
 */
function getTextChildren(card: CanvasElement, store: { getChildren: (id: string) => CanvasElement[] }): {
  title: CanvasElement | null;
  description: CanvasElement | null;
} {
  const children = store.getChildren(card.id).filter((c) => c.type === 'text');
  return {
    title: children[0] ?? null,
    description: children[1] ?? null,
  };
}

export const cardProvider: ContextActionProvider = {
  id: 'card',
  types: ['card'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'card') return [];
    const card = primary as any;
    const { title, description } = getTextChildren(primary, store);
    return [
      {
        id: 'card.editTitle',
        label: 'Editar título',
        icon: Pencil,
        group: 'content',
        run: ({ engine }) => {
          if (!title) return;
          // Selecting BEFORE opening the editor keeps the toolbar pinned
          // to the title node so font/color/bold actions hit the right
          // element while the user types.
          store.setSelectedIds([title.id]);
          engine.beginInlineEdit(title.id);
        },
      },
      {
        id: 'card.editDescription',
        label: 'Editar descrição',
        icon: FileText,
        group: 'content',
        run: ({ engine }) => {
          if (!description) return;
          store.setSelectedIds([description.id]);
          engine.beginInlineEdit(description.id);
        },
      },
      {
        id: 'card.status',
        label: 'Status',
        icon: CheckCircle2,
        group: 'card',
        children: () =>
          STATUSES.map((s) => ({
            id: `card.status.${s.value}`,
            label: s.label,
            group: 'card',
            isToggled: () => card.status === s.value,
            run: () => store.updateElement(primary.id, { status: s.value } as any),
          })),
      },
      {
        id: 'card.priority',
        label: 'Prioridade',
        icon: Flag,
        group: 'card',
        children: () =>
          PRIORITIES.map((p) => ({
            id: `card.priority.${p.value}`,
            label: p.label,
            group: 'card',
            isToggled: () => card.priority === p.value,
            run: () => store.updateElement(primary.id, { priority: p.value } as any),
          })),
      },
      {
        id: 'card.tag',
        label: 'Adicionar tag',
        icon: Tag,
        group: 'card',
        run: () => {
          const tag = window.prompt('Nova tag');
          if (!tag) return;
          const tags: string[] = card.tags ? [...card.tags] : [];
          if (!tags.includes(tag)) tags.push(tag);
          store.updateElement(primary.id, { tags } as any);
        },
      },
      {
        id: 'card.assignee',
        label: 'Atribuir',
        icon: User,
        group: 'card',
        run: () => {
          const name = window.prompt('Responsável', card.assignee ?? '');
          if (name === null) return;
          store.updateElement(primary.id, { assignee: name || undefined } as any);
        },
      },
    ];
  },
  properties: ({ primary, patch, store }) => {
    if (!primary || primary.type !== 'card') return [];
    const card = primary as any;
    const { title, description } = getTextChildren(primary, store);
    return [
      {
        id: 'card.title',
        label: 'Título',
        type: 'text',
        group: 'content',
        get: () => (title as any)?.text ?? '',
        set: (_, v) => {
          if (title) patch(title.id, { text: String(v) } as any);
        },
      },
      {
        id: 'card.description',
        label: 'Descrição',
        type: 'textarea',
        group: 'content',
        get: () => (description as any)?.text ?? '',
        set: (_, v) => {
          if (description) patch(description.id, { text: String(v) } as any);
        },
      },
      {
        id: 'card.status',
        label: 'Status',
        type: 'select',
        group: 'content',
        options: STATUSES.map((s) => ({ value: s.value, label: s.label })),
        get: () => card.status ?? 'todo',
        set: (_, v) => patch(primary.id, { status: String(v) } as any),
      },
      {
        id: 'card.priority',
        label: 'Prioridade',
        type: 'select',
        group: 'content',
        options: PRIORITIES.map((p) => ({ value: p.value, label: p.label })),
        get: () => card.priority ?? 'medium',
        set: (_, v) => patch(primary.id, { priority: String(v) } as any),
      },
      {
        id: 'card.tags',
        label: 'Tags',
        type: 'tags',
        group: 'content',
        get: () => (card.tags as string[]) ?? [],
        set: (_, v) => patch(primary.id, { tags: v as string[] } as any),
      },
      {
        id: 'card.assignee',
        label: 'Responsável',
        type: 'text',
        group: 'content',
        get: () => card.assignee ?? '',
        set: (_, v) => patch(primary.id, { assignee: String(v) || undefined } as any),
      },
    ];
  },
};
