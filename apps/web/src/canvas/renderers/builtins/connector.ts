import { Container } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderConnector: ElementRenderer = () => {
  // Connectors are rendered as overlay containers managed by the engine
  // The engine calls createConnectorContainer directly
  return new Container();
};
