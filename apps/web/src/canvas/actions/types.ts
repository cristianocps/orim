import type { ComponentType, ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CanvasElement } from '@orim/shared';
import type { CanvasEngine } from '../engine.js';
import type { BoardStoreApi } from './storeApi.js';

export type ActionGroup =
  | 'common'
  | 'transform'
  | 'order'
  | 'align'
  | 'style'
  | 'content'
  | 'connector'
  | 'table'
  | 'frame'
  | 'card'
  | 'image'
  | 'drawing'
  | 'ai'
  | 'danger';

export type ActionSurface = 'toolbar' | 'context-menu' | 'properties' | 'palette';

export interface ContextActionContext {
  selection: CanvasElement[];
  primary: CanvasElement | null;
  engine: CanvasEngine;
  store: BoardStoreApi;
}

export interface PropertiesContext extends ContextActionContext {
  /** Update one element via the engine + store, with debounced sync */
  patch: (id: string, patch: Partial<CanvasElement>) => void;
}

export interface ContextAction {
  id: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  shortcut?: string;
  group: ActionGroup;
  /** Surfaces where this action should be exposed. Defaults to all. */
  surfaces?: ActionSurface[];
  isAvailable?: (ctx: ContextActionContext) => boolean;
  isToggled?: (ctx: ContextActionContext) => boolean;
  /** When non-undefined, action becomes a toggle button labelled with this value */
  variant?: 'button' | 'toggle' | 'separator' | 'submenu';
  /** Inline submenu; resolved at render time */
  children?: (ctx: ContextActionContext) => ContextAction[];
  run?: (ctx: ContextActionContext) => void | Promise<void>;
  /** Custom renderer for the toolbar surface (e.g. color picker) */
  renderInToolbar?: ComponentType<{ ctx: ContextActionContext }>;
  /** Custom node for the context menu */
  renderInMenu?: ComponentType<{ ctx: ContextActionContext; onAfter?: () => void }>;
}

export interface PropertyField {
  id: string;
  label: string;
  type:
    | 'text'
    | 'textarea'
    | 'number'
    | 'color'
    | 'select'
    | 'toggle'
    | 'tags'
    | 'slider'
    | 'custom';
  options?: { value: string | number; label: string }[];
  min?: number;
  max?: number;
  step?: number;
  group?: 'appearance' | 'content' | 'layout' | 'advanced';
  get: (ctx: PropertiesContext) => unknown;
  set: (ctx: PropertiesContext, value: unknown) => void;
  isAvailable?: (ctx: PropertiesContext) => boolean;
  render?: ComponentType<{ ctx: PropertiesContext }>;
  description?: string;
}

export interface ContextActionProvider {
  id: string;
  /** Element types this provider applies to. Empty array = global. */
  types: string[];
  actions?: (ctx: ContextActionContext) => ContextAction[];
  properties?: (ctx: PropertiesContext) => PropertyField[];
  /** Optional custom panel renderer beneath the standard property fields */
  renderExtras?: ComponentType<{ ctx: PropertiesContext }>;
}

export interface ResolvedActions {
  byGroup: Map<ActionGroup, ContextAction[]>;
  flat: ContextAction[];
}

export type RenderInToolbar = ComponentType<{ ctx: ContextActionContext }>;
export type ChildrenNode = ReactNode;
