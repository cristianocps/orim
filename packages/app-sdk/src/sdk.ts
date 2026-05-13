import type {
  AppInitPayload,
  CanvasElement,
  ViewportState,
  SDKOptions,
  IncomingMessage,
  OutgoingMessage,
} from './types.js';

let initPayload: AppInitPayload | null = null;
let debugMode = false;
const pending = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
let msgId = 0;

function nextId(): string {
  return `msg-${++msgId}`;
}

function log(...args: any[]) {
  if (debugMode) console.log('[OrimSDK]', ...args);
}

function post(message: OutgoingMessage) {
  if (typeof window !== 'undefined' && window.parent !== window) {
    window.parent.postMessage(message, '*');
  }
}

function handleResponse(event: MessageEvent<IncomingMessage>) {
  const data = event.data;
  if (!data || typeof data !== 'object') return;

  if (data.type === 'app:init') {
    initPayload = data.payload;
    log('initialized with', initPayload);
    initCallbacks.forEach((cb) => cb(initPayload!));
    return;
  }

  const msg = data as any;
  if ('id' in msg && pending.has(msg.id)) {
    const resolver = pending.get(msg.id)!;
    pending.delete(msg.id);
    if (msg.type === 'canvas:elements') resolver.resolve(msg.payload);
    else if (msg.type === 'canvas:viewport') resolver.resolve(msg.payload);
    else if (msg.type === 'canvas:ack') resolver.resolve(msg.payload);
    else resolver.resolve(msg);
  }
}

const initCallbacks: Array<(payload: AppInitPayload) => void> = [];

export function init(options?: SDKOptions) {
  debugMode = options?.debug ?? false;
  if (typeof window !== 'undefined') {
    window.addEventListener('message', handleResponse);
    post({ type: 'app:ready' });
  }
}

export function onInit(callback: (payload: AppInitPayload) => void) {
  if (initPayload) {
    callback(initPayload);
  } else {
    initCallbacks.push(callback);
  }
}

export function getInitPayload(): AppInitPayload | null {
  return initPayload;
}

function request<T>(message: OutgoingMessage & { id: string }): Promise<T> {
  return new Promise((resolve, reject) => {
    pending.set(message.id, { resolve, reject });
    post(message);
    setTimeout(() => {
      if (pending.has(message.id)) {
        pending.delete(message.id);
        reject(new Error('Request timeout'));
      }
    }, 5000);
  });
}

export async function getElements(): Promise<CanvasElement[]> {
  const id = nextId();
  return request<CanvasElement[]>({ type: 'canvas:getElements', id });
}

export async function createElement(el: CanvasElement): Promise<void> {
  const id = nextId();
  await request<void>({ type: 'canvas:createElement', id, payload: el });
}

export async function updateElement(elementId: string, patch: Partial<CanvasElement>): Promise<void> {
  const id = nextId();
  await request<void>({ type: 'canvas:updateElement', id, payload: { id: elementId, patch } });
}

export async function deleteElement(elementId: string): Promise<void> {
  const id = nextId();
  await request<void>({ type: 'canvas:deleteElement', id, payload: { id: elementId } });
}

export async function getViewport(): Promise<ViewportState> {
  const id = nextId();
  return request<ViewportState>({ type: 'canvas:getViewport', id });
}

export function close(): void {
  post({ type: 'app:close' });
}
