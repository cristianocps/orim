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
 * - `__inlineEditor`: default HTML editor descriptor for double-click editing
 * - `__inlineEditors`: optional list of editors keyed by region — used by
 *   composite elements (card with title + description, table cells) so that
 *   double-clicking a specific area edits the right field. The engine picks
 *   the editor whose `bounds` contains the click point; `__inlineEditor` is
 *   used as a fallback if none match.
 */
export type ElementRenderer = (element: CanvasElement) => Container;

export type ElementUpdateHook = (container: Container, patch: Partial<CanvasElement>) => void;

/**
 * The set of element fields the inline editor can write to. New fields
 * (e.g. table cell text) should be added here so the engine's typed patch
 * stays narrow — anything goes through `engine.updateElement`.
 */
export type InlineEditableField = 'text' | 'title' | 'description' | string;

export interface InlineEditorDescriptor {
  /** Field on the element that holds the text */
  field: InlineEditableField;
  /** Multiline editor */
  multiline?: boolean;
  /** Padding inside the bounding rect */
  padding?: number;
  /** Font size in world units */
  fontSize?: number;
  /** Optional explicit bounding rect in element local space */
  bounds?: { x: number; y: number; width: number; height: number };
  /**
   * Human-readable label, used by toolbar actions like "Edit title" /
   * "Edit description". Falls back to the field name if absent.
   */
  label?: string;
  /**
   * Optional override for how the editor commits its value back to the
   * element. Useful for table cells which need to mutate a nested array
   * rather than a top-level field. When omitted, the engine writes
   * `{ [field]: value }` as a normal `updateElement` patch.
   */
  applyValue?: (value: string) => Partial<CanvasElement>;
  /**
   * Pre-computed initial value. When omitted, the engine reads
   * `(element as any)[field]`. Use this for nested data like table cells.
   */
  getValue?: () => string;
  /**
   * CSS color string used by the HTML overlay. Renderers should pass the
   * SAME color they actually drew the text in, so the editor visually
   * replaces the rendered text instead of switching to dark-on-white.
   */
  color?: string;
  /**
   * CSS color string used as the editor's background. Renderers should
   * pass the same color the element fills with so the editor blends with
   * the underlying shape (yellow sticky → yellow editor, blue rectangle →
   * blue editor, etc.).
   */
  background?: string;
}

export interface RendererContainerExtras {
  __getAnchors?: () => AnchorDescriptor[];
  __onUpdate?: ElementUpdateHook;
  __inlineEditor?: InlineEditorDescriptor;
  __inlineEditors?: InlineEditorDescriptor[];
  __preferredCursor?: string;
}
