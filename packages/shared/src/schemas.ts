// Reference shapes that can be copied into zod schemas in api/web

export const elementTypes = [
  'rectangle',
  'circle',
  'ellipse',
  'line',
  'arrow',
  'sticky_note',
  'text',
  'image',
  'connector',
  'frame',
  'card',
  'drawing',
  'table',
] as const;

export type ElementTypeName = (typeof elementTypes)[number];

export const boardRoles = ['owner', 'editor', 'viewer'] as const;

export const appPermissions = [
  'canvas:read',
  'canvas:write',
  'storage:board',
  'storage:user',
  'storage:app',
  'fetch',
  'socket',
  'ui:panel',
  'ui:modal',
  'ui:toolbar',
  'ui:context_menu',
] as const;

export const connectorStyleTypes = ['straight', 'curved', 'elbow'] as const;
export const connectorArrowStyles = ['none', 'triangle', 'diamond', 'circle'] as const;
export const connectorLineStyles = ['solid', 'dashed', 'dotted'] as const;

export const cardStatuses = ['todo', 'in_progress', 'done', 'blocked'] as const;
export const cardPriorities = ['low', 'medium', 'high'] as const;

export const drawingModes = ['pen', 'highlighter', 'eraser'] as const;
