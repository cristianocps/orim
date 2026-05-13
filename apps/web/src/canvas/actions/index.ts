import { contextActionRegistry } from './registry.js';
import { globalActionsProvider } from './providers/global.js';
import { stickyProvider } from './providers/sticky.js';
import { textProvider } from './providers/text.js';
import { shapeProvider } from './providers/shapes.js';
import { frameProvider } from './providers/frame.js';
import { cardProvider } from './providers/card.js';
import { tableProvider } from './providers/table.js';
import { drawingProvider } from './providers/drawing.js';
import { imageProvider } from './providers/image.js';
import { connectorProvider } from './providers/connector.js';

export { contextActionRegistry } from './registry.js';
export type {
  ContextAction,
  ContextActionContext,
  ContextActionProvider,
  PropertiesContext,
  PropertyField,
  ResolvedActions,
  ActionGroup,
  ActionSurface,
} from './types.js';

let registered = false;

export function registerBuiltinProviders() {
  if (registered) return;
  registered = true;
  contextActionRegistry.register(globalActionsProvider);
  contextActionRegistry.register(stickyProvider);
  contextActionRegistry.register(textProvider);
  contextActionRegistry.register(shapeProvider);
  contextActionRegistry.register(frameProvider);
  contextActionRegistry.register(cardProvider);
  contextActionRegistry.register(tableProvider);
  contextActionRegistry.register(drawingProvider);
  contextActionRegistry.register(imageProvider);
  contextActionRegistry.register(connectorProvider);
}
