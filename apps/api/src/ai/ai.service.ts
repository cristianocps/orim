import { Injectable } from '@nestjs/common';
import type { CanvasElement } from '@orim/shared';

export type AIAction =
  | { type: 'create_elements'; elements: CanvasElement[] }
  | { type: 'update_elements'; updates: { id: string; patch: Partial<CanvasElement> }[] }
  | { type: 'group_elements'; groupId: string; elementIds: string[]; label: string }
  | { type: 'create_frame'; frame: CanvasElement; elementIds: string[] }
  | { type: 'summary'; text: string; relatedIds: string[] }
  | { type: 'suggest_next'; suggestions: string[] };

export interface AIPrompt {
  prompt: string;
  boardContext?: {
    boardName: string;
    elements: CanvasElement[];
    selectedIds?: string[];
  };
  mode: 'ask' | 'generate' | 'automate';
}

function mockProcess(prompt: string, elements: CanvasElement[], selectedIds?: string[]): AIAction[] {
  const lower = prompt.toLowerCase();
  const actions: AIAction[] = [];

  const targetElements = selectedIds && selectedIds.length > 0
    ? elements.filter((e) => selectedIds.includes(e.id))
    : elements;

  const stickies = targetElements.filter((e) => e.type === 'sticky_note');
  const texts = targetElements.filter((e) => e.type === 'text');

  if (lower.includes('resumir') || lower.includes('summary') || lower.includes('resumo')) {
    const content = stickies.map((s: any) => s.text).join(', ') || texts.map((t: any) => t.text).join(', ');
    actions.push({
      type: 'summary',
      text: `Resumo: ${content.slice(0, 100)}${content.length > 100 ? '...' : ''}.`,
      relatedIds: targetElements.map((e) => e.id),
    });
    return actions;
  }

  if (lower.includes('agrupar') || lower.includes('grupo') || lower.includes('cluster') || lower.includes('tema')) {
    const groups = ['Ideias', 'Ações', 'Riscos'];
    const shuffled = [...targetElements].sort(() => Math.random() - 0.5);
    groups.forEach((group, i) => {
      const groupElements = shuffled.filter((_, idx) => idx % 3 === i);
      if (groupElements.length > 0) {
        actions.push({ type: 'group_elements', groupId: `group-${i}`, elementIds: groupElements.map((e) => e.id), label: group });
      }
    });
    return actions;
  }

  if (lower.includes('plano') || lower.includes('ação') || lower.includes('action plan') || lower.includes('tarefas')) {
    const cards: CanvasElement[] = [
      { id: crypto.randomUUID(), type: 'card', transform: { x: 0, y: -200, rotation: 0, scaleX: 1, scaleY: 1 }, style: { fill: 0xffffff }, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString(), title: 'Definir escopo', description: 'Documentar requisitos', status: 'todo', priority: 'high', tags: ['planejamento'], size: { width: 240, height: 140 } } as unknown as CanvasElement,
      { id: crypto.randomUUID(), type: 'card', transform: { x: 300, y: -200, rotation: 0, scaleX: 1, scaleY: 1 }, style: { fill: 0xffffff }, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString(), title: 'Criar protótipo', description: 'Desenvolver MVP', status: 'todo', priority: 'high', tags: ['dev'], size: { width: 240, height: 140 } } as unknown as CanvasElement,
      { id: crypto.randomUUID(), type: 'card', transform: { x: 600, y: -200, rotation: 0, scaleX: 1, scaleY: 1 }, style: { fill: 0xffffff }, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString(), title: 'Testar com usuários', description: 'Testes de usabilidade', status: 'todo', priority: 'medium', tags: ['teste'], size: { width: 240, height: 140 } } as unknown as CanvasElement,
    ];
    actions.push({ type: 'create_elements', elements: cards });
    if (cards.length >= 2) {
      for (let i = 0; i < cards.length - 1; i++) {
        actions.push({ type: 'create_elements', elements: [{ id: crypto.randomUUID(), type: 'connector', fromId: cards[i].id, toId: cards[i + 1].id, fromAnchor: 'right', toAnchor: 'left', styleType: 'elbow', transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, style: {}, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString() } as unknown as CanvasElement] });
      }
    }
    return actions;
  }

  if (lower.includes('roadmap') || lower.includes('cronograma') || lower.includes('timeline')) {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4'];
    const els: CanvasElement[] = quarters.map((q, i) => ({
      id: crypto.randomUUID(), type: 'frame', transform: { x: i * 500, y: 0, rotation: 0, scaleX: 1, scaleY: 1 }, style: { fill: 0xf8fafc }, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString(), title: `${q} 2026`, size: { width: 450, height: 400 },
    } as unknown as CanvasElement));
    actions.push({ type: 'create_elements', elements: els });
    return actions;
  }

  if (lower.includes('converter') || lower.includes('card') || lower.includes('tarefa')) {
    const newCards = stickies.map((s: any, i: number) => ({
      id: crypto.randomUUID(), type: 'card', transform: { x: (s.transform?.x ?? 0) + 400, y: s.transform?.y ?? i * 160, rotation: 0, scaleX: 1, scaleY: 1 }, style: { fill: 0xffffff }, metadata: {}, createdBy: 'ai', updatedAt: new Date().toISOString(), title: s.text ?? 'Tarefa', description: 'Convertido de sticky note', status: 'todo', priority: 'medium', tags: ['convertido'], size: { width: 240, height: 140 },
    } as unknown as CanvasElement));
    actions.push({ type: 'create_elements', elements: newCards });
    return actions;
  }

  actions.push({ type: 'suggest_next', suggestions: ['Organizar em roadmap', 'Criar tarefas', 'Identificar riscos', 'Priorizar por impacto'] });
  return actions;
}

@Injectable()
export class AIService {
  async process(input: AIPrompt): Promise<AIAction[]> {
    return mockProcess(input.prompt, input.boardContext?.elements ?? [], input.boardContext?.selectedIds);
  }

  summarize(texts: string[]): string {
    const content = texts.slice(0, 3).join(', ');
    return `Resumo: ${content}${texts.length > 3 ? '...' : ''}. Principais temas: ideação, planejamento e execução.`;
  }
}
