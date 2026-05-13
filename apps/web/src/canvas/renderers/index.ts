import { rendererRegistry } from './registry.js';
import { renderRectangle } from './builtins/rectangle.js';
import { renderCircle } from './builtins/circle.js';
import { renderText } from './builtins/text.js';
import { renderStickyNote } from './builtins/stickyNote.js';
import { renderFrame } from './builtins/frame.js';
import { renderCard } from './builtins/card.js';
import { renderTable } from './builtins/table.js';
import { renderDrawing } from './builtins/drawing.js';
import { renderConnector } from './builtins/connector.js';
import { renderImage } from './builtins/image.js';

export { rendererRegistry } from './registry.js';
export type { ElementRenderer, ElementUpdateHook, InlineEditorDescriptor } from './types.js';

export function registerBuiltinRenderers() {
  rendererRegistry.register('rectangle', renderRectangle);
  rendererRegistry.register('circle', renderCircle);
  rendererRegistry.register('ellipse', renderCircle);
  rendererRegistry.register('text', renderText);
  rendererRegistry.register('sticky_note', renderStickyNote);
  rendererRegistry.register('frame', renderFrame);
  rendererRegistry.register('card', renderCard);
  rendererRegistry.register('table', renderTable);
  rendererRegistry.register('drawing', renderDrawing);
  rendererRegistry.register('connector', renderConnector);
  rendererRegistry.register('image', renderImage);
}
