export interface App {
  id: string;
  name: string;
  description: string;
  iconUrl?: string;
  manifest: AppManifest;
  author: { id: string; name: string };
  versions: AppVersion[];
}

export interface AppVersion {
  id: string;
  version: string;
  entryPoint: string;
}

export interface AppManifest {
  permissions: string[];
  ui?: {
    panel?: boolean;
    toolbar?: boolean;
    modal?: boolean;
  };
}

export interface AppInstall {
  id: string;
  appId: string;
  boardId: string;
  enabled: boolean;
  config: Record<string, unknown>;
  app: App;
}

export async function getApps(): Promise<App[]> {
  const res = await fetch('/api/apps', { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch apps');
  return res.json();
}

export async function getApp(id: string): Promise<App> {
  const res = await fetch(`/api/apps/${id}`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch app');
  return res.json();
}

export async function installApp(appId: string, boardId: string, config?: Record<string, unknown>): Promise<AppInstall> {
  const res = await fetch(`/api/apps/${appId}/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ boardId, config }),
  });
  if (!res.ok) throw new Error('Failed to install app');
  return res.json();
}

export async function uninstallApp(appId: string, boardId: string): Promise<void> {
  const res = await fetch(`/api/apps/${appId}/install`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ boardId }),
  });
  if (!res.ok) throw new Error('Failed to uninstall app');
}

export async function getInstalledApps(boardId: string): Promise<AppInstall[]> {
  const res = await fetch(`/api/apps/board/${boardId}/installed`, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to fetch installed apps');
  return res.json();
}
