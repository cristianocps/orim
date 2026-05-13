import type { CanvasElement } from '@orim/shared';

export interface AIAction {
  type: string;
  elements?: CanvasElement[];
  updates?: { id: string; patch: Partial<CanvasElement> }[];
  groupId?: string;
  elementIds?: string[];
  label?: string;
  frame?: CanvasElement;
  text?: string;
  relatedIds?: string[];
  suggestions?: string[];
}

export async function sendAIPrompt(
  prompt: string,
  boardId: string,
  mode: 'ask' | 'generate' | 'automate' = 'generate',
  selectedIds?: string[]
): Promise<AIAction[]> {
  const res = await fetch('/api/ai/prompt', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ prompt, boardId, mode, selectedIds }),
  });

  if (!res.ok) {
    throw new Error(`AI request failed: ${res.status}`);
  }

  const data = await res.json();
  return data.actions as AIAction[];
}

export async function summarizeElements(
  boardId: string,
  elementIds: string[]
): Promise<{ summary: string; elementCount: number }> {
  const res = await fetch('/api/ai/actions/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ boardId, elementIds }),
  });

  if (!res.ok) throw new Error('Summarize failed');
  return res.json();
}

export async function clusterElements(
  boardId: string,
  elementIds: string[]
): Promise<{ clusters: { label: string; ids: string[] }[] }> {
  const res = await fetch('/api/ai/actions/cluster', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ boardId, elementIds }),
  });

  if (!res.ok) throw new Error('Cluster failed');
  return res.json();
}
