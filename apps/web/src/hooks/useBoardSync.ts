import { useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import type { CanvasEngine } from '../canvas/engine.js';
import type { CanvasElement } from '@orim/shared';
import { patchElements, deleteElement } from '../lib/api.js';
import { useBoardStore } from '../stores/boardStore.js';

export type SaveState = 'idle' | 'pending' | 'syncing' | 'error' | 'offline';

export interface UseBoardSyncResult {
  saveState: SaveState;
  flushNow: () => void;
}

const FLUSH_DEBOUNCE_MS = 350;

export function useBoardSync(
  boardId: string | undefined,
  engine: CanvasEngine | null,
  socket: Socket | null,
): UseBoardSyncResult {
  // pendingRef stores the FULL latest snapshot (not just the patch) for
  // every element with pending changes. This is critical: the previous
  // version stored only the partial patch and reconstructed the full
  // element from `engine.getElement(id)` at flush time. That works for
  // normal debounced flushes but breaks badly on `beforeunload`, because
  // the beforeunload effect captures `flush` from the FIRST render (when
  // `engine` was still null). The fallback `engine?.getElement(id) ?? patch`
  // would silently emit ops with `type: 'unknown'` and `data: {}`, and
  // the backend would happily overwrite the element's real type/data,
  // making the element disappear after F5.
  const pendingRef = useRef<Map<string, CanvasElement>>(new Map());
  const deletedRef = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  // Guard against concurrent flushes. If a flush is already in flight when
  // a new one is triggered, we just mark "needs another flush" and let the
  // current one re-enter when it finishes — that prevents two PATCHes from
  // racing to update the same element.
  const flushingRef = useRef(false);
  const reflushRef = useRef(false);

  const flush = async (options: { keepalive?: boolean } = {}) => {
    if (!boardId) return;
    if (deletedRef.current.size === 0 && pendingRef.current.size === 0) return;
    if (flushingRef.current) {
      reflushRef.current = true;
      return;
    }
    flushingRef.current = true;
    setSaveState('syncing');

    try {
      if (deletedRef.current.size > 0) {
        const ids = Array.from(deletedRef.current);
        deletedRef.current = new Set();
        try {
          await Promise.all(ids.map((id) => deleteElement(boardId, id, { keepalive: options.keepalive })));
        } catch (e) {
          console.error('[useBoardSync] delete failed', e);
          setSaveState('error');
          return;
        }
      }

      if (pendingRef.current.size > 0) {
        const map = pendingRef.current;
        pendingRef.current = new Map();
        const ops = Array.from(map.entries()).map(([id, snapshot]) => {
          const e = snapshot as any;
          // Defensively skip ops we cannot persist correctly. Without a
          // real `type`, the backend would coerce the row into garbage.
          if (!e || typeof e.type !== 'string') {
            console.warn('[useBoardSync] dropping op with missing type', { id, e });
            return null;
          }
          return {
            id,
            type: e.type,
            data: extractData(e),
            transform: e.transform,
            style: e.style ?? {},
            metadata: e.metadata ?? {},
          };
        }).filter(Boolean) as any[];
        if (ops.length > 0) {
          try {
            await patchElements(boardId, ops, { keepalive: options.keepalive });
          } catch (e) {
            console.error('[useBoardSync] patch failed', e, ops);
            setSaveState('error');
            return;
          }
        }
      }
      setSaveState('idle');
    } finally {
      flushingRef.current = false;
      if (reflushRef.current) {
        reflushRef.current = false;
        // Updates queued during the in-flight request — flush them now.
        void flush();
      }
    }
  };

  // Stable reference to the latest `flush` so the beforeunload listener
  // (which only registers once) can always call the freshest closure with
  // the freshest `engine` / `boardId` / `socket` captured.
  const flushRef = useRef(flush);
  flushRef.current = flush;

  const scheduleFlush = () => {
    setSaveState('pending');
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      flush();
    }, FLUSH_DEBOUNCE_MS);
  };

  useEffect(() => {
    if (!engine || !boardId) return;

    const isRemote = () => useBoardStore.getState().isRemoteMutation;

    // Engine emits 'element.transient' on EVERY pointermove during a drag,
    // for EACH dragged element. Without coalescing, dragging a 5-element
    // selection at 120Hz pumps 600 socket messages per second — that
    // saturates the websocket and starves the persistence PATCHes.
    // We batch by id and flush at most once every 60ms (~16Hz) per element,
    // sending only the latest transform for each id (intermediate frames
    // are visually irrelevant for remote viewers).
    const TRANSIENT_INTERVAL_MS = 60;
    const transientPending = new Map<string, any>();
    let transientLastSent = 0;
    let transientTimer: ReturnType<typeof setTimeout> | null = null;
    const sendTransient = () => {
      transientTimer = null;
      if (!socket || transientPending.size === 0) return;
      transientPending.forEach((transform, id) => {
        socket.emit('element:transient', { boardId, id, transform });
      });
      transientPending.clear();
      transientLastSent = performance.now();
    };
    const onTransient = ({ id, transform }: { id: string; transform: any }) => {
      if (isRemote()) return;
      transientPending.set(id, transform);
      const now = performance.now();
      const elapsed = now - transientLastSent;
      if (elapsed >= TRANSIENT_INTERVAL_MS) {
        if (transientTimer !== null) {
          clearTimeout(transientTimer);
          transientTimer = null;
        }
        sendTransient();
      } else if (transientTimer === null) {
        transientTimer = setTimeout(sendTransient, TRANSIENT_INTERVAL_MS - elapsed);
      }
    };

    const onCreated = (el: CanvasElement) => {
      if (isRemote()) return;
      // Mirror to store so UI selection / actions see the new element.
      useBoardStore.setState((s) => {
        if (s.elements.some((e) => e.id === el.id)) return s;
        return { ...s, elements: [...s.elements, el] };
      });
      pendingRef.current.set(el.id, el);
      scheduleFlush();
      if (socket) socket.emit('element:created', { boardId, element: el });
    };

    const onUpdated = ({ id, patch }: { id: string; patch: Partial<CanvasElement> }) => {
      if (isRemote()) return;
      // Final transform/style/etc. patches arrive on pointerup / inline edit
      // commit / property change — they're "settled" events, not mid-drag
      // noise, so drop any pending coalesced transient for this id (the
      // settled patch already supersedes them).
      transientPending.delete(id);
      // Mirror to store so React-side reads (selection ctx, properties) stay fresh.
      useBoardStore.setState((s) => ({
        ...s,
        elements: s.elements.map((e) => (e.id === id ? mergeDeep(e as any, patch as any) : e)),
      }));
      // Always persist the FULL latest snapshot, not just the partial patch
      // we received. The engine already has the merged version; if for some
      // reason it doesn't (e.g. partial-init edge cases), fall back to
      // merging the previous pending snapshot with the patch so we never
      // lose the `type` / `data` fields that the backend uses to upsert.
      const fullEl = engine.getElement(id) as CanvasElement | undefined;
      if (fullEl) {
        pendingRef.current.set(id, fullEl);
      } else {
        const existing = pendingRef.current.get(id);
        if (existing) {
          pendingRef.current.set(id, mergeDeep(existing as any, patch as any) as CanvasElement);
        }
        // If neither engine nor pending has the element, we genuinely don't
        // know what type / data it is; dropping is safer than emitting a
        // garbage upsert that would corrupt the row.
      }
      scheduleFlush();
      if (socket) socket.emit('element:updated', { boardId, id, patch });
    };

    const onDeleted = ({ id }: { id: string }) => {
      if (isRemote()) return;
      useBoardStore.setState((s) => ({
        ...s,
        elements: s.elements.filter((e) => e.id !== id),
        selectedIds: s.selectedIds.filter((sid) => sid !== id),
        primarySelectionId: s.primarySelectionId === id ? null : s.primarySelectionId,
      }));
      deletedRef.current.add(id);
      pendingRef.current.delete(id);
      scheduleFlush();
      if (socket) socket.emit('element:deleted', { boardId, elementId: id });
    };

    engine.on('element.created', onCreated);
    engine.on('element.updated', onUpdated);
    engine.on('element.transient', onTransient);
    engine.on('element.deleted', onDeleted);

    return () => {
      engine.off('element.created', onCreated);
      engine.off('element.updated', onUpdated);
      engine.off('element.transient', onTransient);
      engine.off('element.deleted', onDeleted);
      if (transientTimer !== null) clearTimeout(transientTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
      flush();
    };
  }, [engine, boardId, socket]);

  // Beforeunload flush — uses fetch keepalive so the request survives the
  // navigation/tab close even though the page is being torn down.
  // We register exactly once and call through `flushRef.current` to always
  // hit the latest closure (with the freshest engine + boardId + socket).
  // Registering this with `[]` deps was correct, but calling `flush`
  // directly captured the FIRST render's flush — at that point `engine`
  // was still null, which silently corrupted PATCH payloads on F5.
  useEffect(() => {
    const onBeforeUnload = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      void flushRef.current({ keepalive: true });
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, []);

  return { saveState, flushNow: flush };
}

function extractData(el: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!el) return {};
  const { id, type, transform, style, metadata, createdBy, updatedAt, parentId, ...rest } = el as any;
  void id; void type; void transform; void style; void metadata; void createdBy; void updatedAt; void parentId;
  return rest;
}

function mergeDeep<T extends Record<string, any>>(a: T, b: Partial<T>): T {
  const out: Record<string, any> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && a[k] && typeof a[k] === 'object') {
      out[k] = mergeDeep(a[k], v);
    } else {
      out[k] = v;
    }
  }
  return out as T;
}
