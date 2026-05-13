import { Plus, Minus, Heading, RowsIcon as ColumnsIcon, Rows3 } from 'lucide-react';
import type { ContextActionProvider } from '../types.js';

interface TableData {
  rows: number;
  cols: number;
  cells: { text?: string; backgroundColor?: number; align?: string }[][];
  colWidths: number[];
  rowHeights: number[];
  headerRow?: boolean;
}

function readTable(el: any): TableData {
  return {
    rows: el.rows ?? 3,
    cols: el.cols ?? 3,
    cells: el.cells ?? Array.from({ length: el.rows ?? 3 }, () => Array.from({ length: el.cols ?? 3 }, () => ({ text: '' }))),
    colWidths: el.colWidths ?? Array(el.cols ?? 3).fill(120),
    rowHeights: el.rowHeights ?? Array(el.rows ?? 3).fill(36),
    headerRow: el.headerRow ?? false,
  };
}

function addRow(table: TableData, position: 'end' | 'start'): TableData {
  const newRow = Array.from({ length: table.cols }, () => ({ text: '' }));
  const cells = position === 'end' ? [...table.cells, newRow] : [newRow, ...table.cells];
  const rowHeights = position === 'end' ? [...table.rowHeights, 36] : [36, ...table.rowHeights];
  return { ...table, rows: table.rows + 1, cells, rowHeights };
}

function removeRow(table: TableData, index: number): TableData {
  if (table.rows <= 1) return table;
  const cells = table.cells.filter((_, i) => i !== index);
  const rowHeights = table.rowHeights.filter((_, i) => i !== index);
  return { ...table, rows: table.rows - 1, cells, rowHeights };
}

function addCol(table: TableData, position: 'end' | 'start'): TableData {
  const cells = table.cells.map((row) =>
    position === 'end' ? [...row, { text: '' }] : [{ text: '' }, ...row],
  );
  const colWidths = position === 'end' ? [...table.colWidths, 120] : [120, ...table.colWidths];
  return { ...table, cols: table.cols + 1, cells, colWidths };
}

function removeCol(table: TableData, index: number): TableData {
  if (table.cols <= 1) return table;
  const cells = table.cells.map((row) => row.filter((_, i) => i !== index));
  const colWidths = table.colWidths.filter((_, i) => i !== index);
  return { ...table, cols: table.cols - 1, cells, colWidths };
}

export const tableProvider: ContextActionProvider = {
  id: 'table',
  types: ['table'],
  actions: ({ primary, store }) => {
    if (!primary || primary.type !== 'table') return [];
    const table = readTable(primary as any);
    return [
      {
        id: 'table.addRow',
        label: 'Adicionar linha',
        icon: Plus,
        group: 'table',
        run: () => store.updateElement(primary.id, addRow(table, 'end') as any),
      },
      {
        id: 'table.removeRow',
        label: 'Remover última linha',
        icon: Minus,
        group: 'table',
        isAvailable: () => table.rows > 1,
        run: () => store.updateElement(primary.id, removeRow(table, table.rows - 1) as any),
      },
      {
        id: 'table.addCol',
        label: 'Adicionar coluna',
        icon: ColumnsIcon,
        group: 'table',
        run: () => store.updateElement(primary.id, addCol(table, 'end') as any),
      },
      {
        id: 'table.removeCol',
        label: 'Remover última coluna',
        icon: Minus,
        group: 'table',
        isAvailable: () => table.cols > 1,
        run: () => store.updateElement(primary.id, removeCol(table, table.cols - 1) as any),
      },
      {
        id: 'table.toggleHeader',
        label: 'Alternar cabeçalho',
        icon: Heading,
        group: 'table',
        isToggled: () => Boolean(table.headerRow),
        run: () => store.updateElement(primary.id, { headerRow: !table.headerRow } as any),
      },
      {
        id: 'table.toCards',
        label: 'Transformar em cards',
        icon: Rows3,
        group: 'table',
        run: () => {
          const card = (primary as any).transform;
          const startX = card.x;
          const startY = card.y;
          for (let r = table.headerRow ? 1 : 0; r < table.rows; r++) {
            const row = table.cells[r] ?? [];
            const title = row[0]?.text ?? `Linha ${r + 1}`;
            const description = row.slice(1).map((c) => c.text).filter(Boolean).join(' • ');
            const id = crypto.randomUUID();
            store.addElement({
              id,
              type: 'card',
              title,
              description,
              status: 'todo',
              priority: 'medium',
              tags: [],
              size: { width: 240, height: 140 },
              transform: { x: startX + (r % 4) * 280, y: startY + Math.floor(r / 4) * 180 + 320, rotation: 0, scaleX: 1, scaleY: 1 },
              style: {},
              metadata: {},
              createdBy: 'local-user',
              updatedAt: new Date().toISOString(),
            } as any);
          }
        },
      },
    ];
  },
  properties: ({ primary, patch }) => {
    if (!primary || primary.type !== 'table') return [];
    const table = readTable(primary as any);
    return [
      {
        id: 'table.rows',
        label: 'Linhas',
        type: 'number',
        group: 'layout',
        get: () => table.rows,
        set: (_, v) => {
          const target = Math.max(1, Number(v));
          let next = table;
          while (next.rows < target) next = addRow(next, 'end');
          while (next.rows > target) next = removeRow(next, next.rows - 1);
          patch(primary.id, next as any);
        },
      },
      {
        id: 'table.cols',
        label: 'Colunas',
        type: 'number',
        group: 'layout',
        get: () => table.cols,
        set: (_, v) => {
          const target = Math.max(1, Number(v));
          let next = table;
          while (next.cols < target) next = addCol(next, 'end');
          while (next.cols > target) next = removeCol(next, next.cols - 1);
          patch(primary.id, next as any);
        },
      },
      {
        id: 'table.headerRow',
        label: 'Cabeçalho',
        type: 'toggle',
        group: 'appearance',
        get: () => Boolean(table.headerRow),
        set: (_, v) => patch(primary.id, { headerRow: Boolean(v) } as any),
      },
    ];
  },
};
