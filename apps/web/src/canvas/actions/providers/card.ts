import { CheckCircle2, Flag, Tag, User, Pencil, FileText } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

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

export const cardProvider: ContextActionProvider = {
  id: 'card',
  types: ['card'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'card') return [];
    const card = primary as any;
    return [
      {
        id: 'card.editTitle',
        label: 'Editar título',
        icon: Pencil,
        group: 'content',
        run: ({ engine }) => engine.beginInlineEdit(primary.id, { field: 'title' }),
      },
      {
        id: 'card.editDescription',
        label: 'Editar descrição',
        icon: FileText,
        group: 'content',
        run: ({ engine }) => engine.beginInlineEdit(primary.id, { field: 'description' }),
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
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'card') return [];
    const card = primary as any;
    return [
      {
        id: 'card.title',
        label: 'Título',
        type: 'text',
        group: 'content',
        get: () => card.title ?? '',
        set: (_, v) => patch(primary.id, { title: String(v) } as any),
      },
      {
        id: 'card.description',
        label: 'Descrição',
        type: 'textarea',
        group: 'content',
        get: () => card.description ?? '',
        set: (_, v) => patch(primary.id, { description: String(v) } as any),
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
