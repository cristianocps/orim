import { create } from 'zustand';
import type { CanvasEngine } from '../canvas/engine.js';
import type { CanvasElement, ViewportState } from '@orim/shared';

export interface HistoryAction {
  type: 'create' | 'update' | 'delete';
  id: string;
  element?: CanvasElement;
  before?: Partial<CanvasElement>;
  after?: Partial<CanvasElement>;
}

interface BoardState {
  engine: CanvasEngine | null;
  elements: CanvasElement[];
  selectedIds: string[];
  primarySelectionId: string | null;
  viewport: ViewportState;
  history: HistoryAction[];
  future: HistoryAction[];
  isUndoing: boolean;
  /** True while applying a remote mutation (from WebSocket). When true,
   *  store actions don't trigger sync emissions. */
  isRemoteMutation: boolean;
  setEngine: (engine: CanvasEngine | null) => void;
  getEngine: () => CanvasEngine | null;
  setElements: (elements: CanvasElement[]) => void;
  addElement: (el: CanvasElement, skipHistory?: boolean) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>, skipHistory?: boolean) => void;
  removeElement: (id: string, skipHistory?: boolean) => void;
  applyRemote: (run: () => void) => void;
  setSelectedIds: (ids: string[], primaryId?: string | null) => void;
  setViewport: (v: ViewportState) => void;
  getElement: (id: string) => CanvasElement | null;
  getElements: () => CanvasElement[];
  /**
   * Direct children of the given element (one level deep). The store keeps
   * elements as a flat array; these helpers recompute the tree on read.
   * Cheap because boards rarely exceed a few hundred elements.
   */
  getChildren: (parentId: string) => CanvasElement[];
  /**
   * Walk up to the topmost ancestor (the "root" of the selection tree).
   * Used by Figma-style selection: a single click on a child resolves to
   * its root before highlighting.
   */
  getRoot: (id: string) => CanvasElement | null;
  /**
   * All descendants (children + grand-children + ...). Used for cascade
   * delete on the engine so leaving the parent visually removes everything
   * inside it without orphaning rows.
   */
  getDescendants: (id: string) => CanvasElement[];
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearHistory: () => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  engine: null,
  elements: [],
  selectedIds: [],
  primarySelectionId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  history: [],
  future: [],
  isUndoing: false,
  isRemoteMutation: false,

  setEngine: (engine) => set({ engine }),
  getEngine: () => get().engine,
  setElements: (elements) => set({ elements }),

  applyRemote: (run) => {
    set({ isRemoteMutation: true });
    try {
      run();
    } finally {
      set({ isRemoteMutation: false });
    }
  },

  addElement: (el, skipHistory = false) => {
    const { engine, isRemoteMutation } = get();
    // Engine emits 'element.created' so useBoardSync persists. For remote
    // mutations we skip the emit because the change came from the wire.
    if (engine && !engine.getElement(el.id)) {
      engine.createElement(el, { skipEmit: isRemoteMutation });
    }
    set((s) => {
      const exists = s.elements.some((e) => e.id === el.id);
      const elements = exists ? s.elements : [...s.elements, el];
      if (skipHistory || s.isUndoing) return { ...s, elements };
      return {
        ...s,
        elements,
        history: [...s.history, { type: 'create', id: el.id, element: el }],
        future: [],
      };
    });
  },

  updateElement: (id, patch, skipHistory = false) => {
    const { engine, isRemoteMutation } = get();
    const current = get().elements.find((e) => e.id === id);
    if (!current) return;
    if (engine) engine.updateElement(id, patch, { skipEmit: isRemoteMutation });
    set((s) => {
      const nextElements = s.elements.map((e) =>
        e.id === id ? mergeElement(e, patch) : e,
      );
      if (skipHistory || s.isUndoing) return { ...s, elements: nextElements };
      const before: Partial<CanvasElement> = {};
      for (const key of Object.keys(patch)) {
        (before as any)[key] = (current as any)[key];
      }
      return {
        ...s,
        elements: nextElements,
        history: [...s.history, { type: 'update', id, before, after: patch }],
        future: [],
      };
    });
  },

  removeElement: (id, skipHistory = false) => {
    const { engine, isRemoteMutation } = get();
    const element = get().elements.find((e) => e.id === id);
    if (!element) return;
    if (engine) engine.deleteElement(id, { skipEmit: isRemoteMutation });
    set((s) => {
      const nextElements = s.elements.filter((e) => e.id !== id);
      const nextSelectedIds = s.selectedIds.filter((sid) => sid !== id);
      const nextPrimary = s.primarySelectionId === id ? null : s.primarySelectionId;
      if (skipHistory || s.isUndoing) {
        return { ...s, elements: nextElements, selectedIds: nextSelectedIds, primarySelectionId: nextPrimary };
      }
      return {
        ...s,
        elements: nextElements,
        selectedIds: nextSelectedIds,
        primarySelectionId: nextPrimary,
        history: [...s.history, { type: 'delete', id, element }],
        future: [],
      };
    });
  },

  setSelectedIds: (ids, primaryId) =>
    set({
      selectedIds: ids,
      primarySelectionId: primaryId ?? (ids.length > 0 ? ids[ids.length - 1] : null),
    }),
  setViewport: (v) => set({ viewport: v }),

  getElement: (id) => get().elements.find((e) => e.id === id) ?? null,
  getElements: () => get().elements,

  getChildren: (parentId) => get().elements.filter((e) => e.parentId === parentId),

  getRoot: (id) => {
    const elements = get().elements;
    const byId = new Map(elements.map((e) => [e.id, e] as const));
    let current = byId.get(id) ?? null;
    // Defensive: if a cycle ever sneaks in (shouldn't), bail after a
    // generous number of hops instead of looping.
    for (let i = 0; i < 64 && current?.parentId; i++) {
      const next = byId.get(current.parentId);
      if (!next || next.id === current.id) break;
      current = next;
    }
    return current;
  },

  getDescendants: (id) => {
    const elements = get().elements;
    const byParent = new Map<string, CanvasElement[]>();
    for (const e of elements) {
      if (!e.parentId) continue;
      const list = byParent.get(e.parentId);
      if (list) list.push(e);
      else byParent.set(e.parentId, [e]);
    }
    const out: CanvasElement[] = [];
    const stack: string[] = [id];
    while (stack.length > 0) {
      const next = stack.pop()!;
      const kids = byParent.get(next);
      if (!kids) continue;
      for (const k of kids) {
        out.push(k);
        stack.push(k.id);
      }
    }
    return out;
  },

  undo: () => {
    const { history, engine } = get();
    if (history.length === 0) return;
    const action = history[history.length - 1];
    set({ isUndoing: true });
    switch (action.type) {
      case 'create': {
        if (engine) engine.deleteElement(action.id);
        set((s) => ({
          elements: s.elements.filter((e) => e.id !== action.id),
          selectedIds: s.selectedIds.filter((sid) => sid !== action.id),
        }));
        break;
      }
      case 'update': {
        if (engine && action.before) engine.updateElement(action.id, action.before);
        set((s) => ({
          elements: s.elements.map((e) =>
            e.id === action.id ? mergeElement(e, action.before ?? {}) : e,
          ),
        }));
        break;
      }
      case 'delete': {
        if (engine && action.element) engine.createElement(action.element);
        set((s) => ({ elements: [...s.elements, action.element!] }));
        break;
      }
    }
    set((s) => ({
      history: s.history.slice(0, -1),
      future: [action, ...s.future],
      isUndoing: false,
    }));
  },

  redo: () => {
    const { future, engine } = get();
    if (future.length === 0) return;
    const action = future[0];
    set({ isUndoing: true });
    switch (action.type) {
      case 'create': {
        if (engine && action.element) engine.createElement(action.element);
        set((s) => ({ elements: [...s.elements, action.element!] }));
        break;
      }
      case 'update': {
        if (engine && action.after) engine.updateElement(action.id, action.after);
        set((s) => ({
          elements: s.elements.map((e) =>
            e.id === action.id ? mergeElement(e, action.after ?? {}) : e,
          ),
        }));
        break;
      }
      case 'delete': {
        if (engine) engine.deleteElement(action.id);
        set((s) => ({
          elements: s.elements.filter((e) => e.id !== action.id),
          selectedIds: s.selectedIds.filter((sid) => sid !== action.id),
        }));
        break;
      }
    }
    set((s) => ({
      history: [...s.history, action],
      future: s.future.slice(1),
      isUndoing: false,
    }));
  },

  canUndo: () => get().history.length > 0,
  canRedo: () => get().future.length > 0,
  clearHistory: () => set({ history: [], future: [] }),
}));

function mergeElement(el: CanvasElement, patch: Partial<CanvasElement>): CanvasElement {
  const next: any = { ...el };
  for (const [k, v] of Object.entries(patch)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && (el as any)[k] && typeof (el as any)[k] === 'object') {
      next[k] = { ...(el as any)[k], ...(v as any) };
    } else {
      next[k] = v;
    }
  }
  return next as CanvasElement;
}
