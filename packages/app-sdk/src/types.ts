export interface AppInitPayload {
  appId: string;
  boardId: string;
}

export interface Point {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface Transform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export interface CanvasElement {
  id: string;
  type: string;
  transform: Transform;
  style: Record<string, unknown>;
  metadata: Record<string, unknown>;
  createdBy: string;
  updatedAt: string;
  [key: string]: unknown;
}

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface SDKOptions {
  debug?: boolean;
}

export type OutgoingMessage =
  | { type: 'app:ready' }
  | { type: 'app:close' }
  | { type: 'canvas:getElements'; id: string }
  | { type: 'canvas:createElement'; id: string; payload: CanvasElement }
  | { type: 'canvas:updateElement'; id: string; payload: { id: string; patch: Partial<CanvasElement> } }
  | { type: 'canvas:deleteElement'; id: string; payload: { id: string } }
  | { type: 'canvas:getViewport'; id: string };

export type IncomingMessage =
  | { type: 'app:init'; payload: AppInitPayload }
  | { type: 'canvas:elements'; id: string; payload: CanvasElement[] }
  | { type: 'canvas:viewport'; id: string; payload: ViewportState };
