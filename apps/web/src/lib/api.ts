export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Board {
  id: string;
  name: string;
  description?: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export async function register(data: { email: string; name: string; password: string }): Promise<{ user: User }> {
  const res = await fetch('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Register failed');
  return res.json();
}

export async function login(data: { email: string; password: string }): Promise<{ user: User }> {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? 'Login failed');
  return res.json();
}

export async function logout(): Promise<void> {
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
}

export async function me(): Promise<{ user: User | null }> {
  const res = await fetch('/api/auth/me', { credentials: 'include' });
  if (!res.ok) return { user: null };
  return res.json();
}

export async function getBoards(): Promise<Board[]> {
  const res = await fetch('/api/boards', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch boards');
  return res.json();
}

export async function getBoard(id: string): Promise<Board & { elements: any[]; members: any[] }> {
  const res = await fetch(`/api/boards/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch board');
  return res.json();
}

export async function createBoard(name: string, description?: string): Promise<Board> {
  const res = await fetch('/api/boards', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ name, description }),
  });
  if (!res.ok) throw new Error('Failed to create board');
  return res.json();
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    return (
      (body?.message && (Array.isArray(body.message) ? body.message.join(', ') : String(body.message))) ||
      body?.error ||
      `${fallback} (${res.status})`
    );
  } catch {
    return `${fallback} (${res.status})`;
  }
}

export async function patchElements(
  boardId: string,
  ops: any[],
  options: { keepalive?: boolean } = {},
): Promise<any[]> {
  const res = await fetch(`/api/boards/${boardId}/elements`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(ops),
    keepalive: options.keepalive,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to patch elements'));
  return res.json();
}

export async function deleteElement(
  boardId: string,
  elementId: string,
  options: { keepalive?: boolean } = {},
): Promise<void> {
  const res = await fetch(`/api/boards/${boardId}/elements/${elementId}`, {
    method: 'DELETE',
    credentials: 'include',
    keepalive: options.keepalive,
  });
  if (!res.ok) throw new Error(await readErrorMessage(res, 'Failed to delete element'));
}

export function flattenElement(raw: any): any {
  return {
    id: raw.id,
    type: raw.type,
    ...(raw.data ?? {}),
    transform: raw.transform,
    style: raw.style ?? {},
    metadata: raw.metadata ?? {},
    createdBy: raw.createdBy,
    updatedAt: raw.updatedAt,
    parentId: raw.parentId,
  };
}
