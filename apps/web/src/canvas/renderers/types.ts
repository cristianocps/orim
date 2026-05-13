import type { Container } from 'pixi.js';
import type { CanvasElement } from '@orim/shared';
import type { AnchorDescriptor } from '../connectors.js';

/**
 * The engine handles position/rotation/scale, selection, dragging, lifecycle.
 * The renderer handles only the visual content inside the container.
 *
 * Renderers may attach metadata to the returned container:
 * - `__getAnchors`: function returning AnchorDescriptor[] for connector handles
 * - `__onUpdate`: function called when the engine receives a non-transform patch
 * - `__getBounds`: optional override for selection bounds
 * - `__inlineEditor`: HTML editor descriptor for double-click editing
 */
export type ElementRenderer = (element: CanvasElement) => Container;

export type ElementUpdateHook = (container: Container, patch: Partial<CanvasElement>) => void;

export interface InlineEditorDescriptor {
  /** Field on the element that holds the text */
  field: 'text' | 'title' | 'description';
  /** Multiline editor */
  multiline?: boolean;
  /** Padding inside the bounding rect */
  padding?: number;
  /** Font size in world units */
  fontSize?: number;
  /** Optional explicit bounding rect in element local space */
  bounds?: { x: number; y: number; width: number; height: number };
}

export interface RendererContainerExtras {
  __getAnchors?: () => AnchorDescriptor[];
  __onUpdate?: ElementUpdateHook;
  __inlineEditor?: InlineEditorDescriptor;
  __preferredCursor?: string;
}
