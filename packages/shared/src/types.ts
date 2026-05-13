// Core entity types for the canvas

export type UUID = string;

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

export type ElementType =
  | 'rectangle'
  | 'circle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'sticky_note'
  | 'text'
  | 'image'
  | 'connector'
  | 'frame'
  | 'card'
  | 'drawing'
  | 'table';

export interface ElementMetadata {
  locked?: boolean;
  zIndex?: number;
  groupId?: string | null;
  hidden?: boolean;
  comments?: number;
  [key: string]: unknown;
}

export interface BaseElement {
  id: UUID;
  type: ElementType;
  transform: Transform;
  style: Record<string, unknown>;
  metadata: ElementMetadata;
  createdBy: UUID;
  updatedAt: string;
  parentId?: UUID | null;
}

export interface RectangleElement extends BaseElement {
  type: 'rectangle';
  size: Size;
}

export interface CircleElement extends BaseElement {
  type: 'circle';
  radius: number;
}

export interface TextElement extends BaseElement {
  type: 'text';
  text: string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
}

export interface StickyNoteElement extends BaseElement {
  type: 'sticky_note';
  text: string;
  color?: string;
  size?: Size;
}

export interface FrameElement extends BaseElement {
  type: 'frame';
  title: string;
  size: Size;
}

export type ConnectorAnchorId = string;

export type ConnectorEndpoint =
  | { kind: 'element'; elementId: string; anchorId: ConnectorAnchorId }
  | { kind: 'point'; x: number; y: number };

export type ConnectorArrowStyle = 'none' | 'triangle' | 'diamond' | 'circle';

export type ConnectorLineStyle = 'solid' | 'dashed' | 'dotted';

export interface ConnectorElement extends BaseElement {
  type: 'connector';
  from: ConnectorEndpoint;
  to: ConnectorEndpoint;
  styleType: 'straight' | 'curved' | 'elbow';
  arrowStart?: ConnectorArrowStyle;
  arrowEnd?: ConnectorArrowStyle;
  label?: string;
  lineStyle?: ConnectorLineStyle;
  strokeWidth?: number;
  strokeColor?: number;
  waypoints?: { x: number; y: number }[];
  /** @deprecated keep for backwards compat */
  fromId?: string;
  /** @deprecated keep for backwards compat */
  toId?: string;
  /** @deprecated keep for backwards compat */
  fromAnchor?: 'top' | 'bottom' | 'left' | 'right' | 'center';
  /** @deprecated keep for backwards compat */
  toAnchor?: 'top' | 'bottom' | 'left' | 'right' | 'center';
}

export interface ImageElement extends BaseElement {
  type: 'image';
  url: string;
  size: Size;
  alt?: string;
  cropBox?: { x: number; y: number; width: number; height: number };
}

export interface CardElement extends BaseElement {
  type: 'card';
  title: string;
  description?: string;
  assignee?: string;
  status: 'todo' | 'in_progress' | 'done' | 'blocked';
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  dueDate?: string;
  size: Size;
}

export interface DrawingElement extends BaseElement {
  type: 'drawing';
  points: { x: number; y: number }[];
  color: number;
  strokeWidth: number;
  mode: 'pen' | 'highlighter' | 'eraser';
}

export interface TableCell {
  text: string;
  colSpan?: number;
  rowSpan?: number;
  backgroundColor?: string;
}

export interface TableElement extends BaseElement {
  type: 'table';
  rows: number;
  cols: number;
  cells: TableCell[][];
  colWidths: number[];
  rowHeights: number[];
  headerRow?: boolean;
}

export type CanvasElement =
  | RectangleElement
  | CircleElement
  | TextElement
  | StickyNoteElement
  | FrameElement
  | ConnectorElement
  | CardElement
  | DrawingElement
  | TableElement
  | ImageElement;

// Board types

export interface Board {
  id: UUID;
  name: string;
  description?: string;
  ownerId: UUID;
  createdAt: string;
  updatedAt: string;
  thumbnailUrl?: string;
}

export interface BoardMember {
  boardId: UUID;
  userId: UUID;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}

// User types

export interface User {
  id: UUID;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

// Real-time events

export interface CursorPosition {
  userId: UUID;
  name: string;
  color: string;
  x: number;
  y: number;
}

export type BoardEvent =
  | { type: 'element.created'; payload: { element: CanvasElement; mutationId?: string } }
  | { type: 'element.updated'; payload: { id: UUID; patch: Partial<CanvasElement>; mutationId?: string } }
  | { type: 'element.deleted'; payload: { id: UUID; mutationId?: string } }
  | { type: 'element.transient'; payload: { id: UUID; transform: Partial<Transform>; mutationId?: string } }
  | { type: 'element.locked'; payload: { id: UUID; userId: UUID; expiresAt?: string } }
  | { type: 'element.unlocked'; payload: { id: UUID } }
  | { type: 'selection.changed'; payload: { userId: UUID; ids: UUID[] } }
  | { type: 'cursor.moved'; payload: CursorPosition }
  | { type: 'user.joined'; payload: { userId: UUID; name: string } }
  | { type: 'user.left'; payload: { userId: UUID } };

// Viewport

export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

// App / SDK types

export interface AppManifest {
  id: UUID;
  name: string;
  description: string;
  version: string;
  sdkVersion: string;
  iconUrl?: string;
  authorId: UUID;
  permissions: AppPermission[];
  entryPoint: string;
}

export type AppPermission =
  | 'canvas:read'
  | 'canvas:write'
  | 'storage:board'
  | 'storage:user'
  | 'storage:app'
  | 'fetch'
  | 'socket'
  | 'ui:panel'
  | 'ui:modal'
  | 'ui:toolbar'
  | 'ui:context_menu';

export interface AppInstall {
  id: UUID;
  appId: UUID;
  boardId: UUID;
  installedBy: UUID;
  config: Record<string, unknown>;
  enabled: boolean;
  installedAt: string;
}
