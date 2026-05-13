import type { CanvasElement } from '@orim/shared';

/** Subset of the board store the action system uses. Defined here to avoid
 *  pulling Zustand into this module. */
export interface BoardStoreApi {
  addElement: (el: CanvasElement, skipHistory?: boolean) => void;
  updateElement: (id: string, patch: Partial<CanvasElement>, skipHistory?: boolean) => void;
  removeElement: (id: string, skipHistory?: boolean) => void;
  setSelectedIds: (ids: string[]) => void;
  getElement: (id: string) => CanvasElement | null;
  getElements: () => CanvasElement[];
}
