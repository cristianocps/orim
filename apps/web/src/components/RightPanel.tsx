import { useEffect, useState } from 'react';
import {
  X,
  Sparkles,
  Layers,
  MessageSquare,
  History,
  Settings,
  Wand2,
  BrainCircuit,
  FileText,
  List,
  Zap,
  Loader2,
  Puzzle,
  ExternalLink,
} from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import { sendAIPrompt, type AIAction } from '../lib/ai.js';
import { getInstalledApps, type AppInstall } from '../lib/apps.js';
import { PropertiesPanel } from './PropertiesPanel.js';
import './RightPanel.css';

type PanelTab = 'ai' | 'properties' | 'layers' | 'comments' | 'history' | 'apps';

const tabs = [
  { id: 'ai' as PanelTab, icon: Sparkles, label: 'IA' },
  { id: 'properties' as PanelTab, icon: Settings, label: 'Propriedades' },
  { id: 'layers' as PanelTab, icon: Layers, label: 'Camadas' },
  { id: 'comments' as PanelTab, icon: MessageSquare, label: 'Comentários' },
  { id: 'history' as PanelTab, icon: History, label: 'Histórico' },
  { id: 'apps' as PanelTab, icon: Puzzle, label: 'Apps' },
];

const aiQuickActions = [
  { icon: BrainCircuit, label: 'Resumir conteúdo', desc: 'Resuma os itens selecionados', prompt: 'resumir' },
  { icon: List, label: 'Agrupar por tema', desc: 'Organize ideias em clusters', prompt: 'agrupar' },
  { icon: FileText, label: 'Gerar plano de ação', desc: 'Crie tarefas a partir das ideias', prompt: 'plano de ação' },
  { icon: Zap, label: 'Criar roadmap', desc: 'Transforme em um roadmap visual', prompt: 'roadmap' },
  { icon: Wand2, label: 'Converter em cards', desc: 'Transforme stickies em tarefas', prompt: 'converter em cards' },
];

interface RightPanelProps {
  engine?: CanvasEngine | null;
  boardId?: string;
  onOpenApp?: (url: string, appId: string) => void;
}

export function RightPanel({ engine, boardId, onOpenApp }: RightPanelProps) {
  const [activeTab, setActiveTab] = useState<PanelTab>('ai');
  const [collapsed, setCollapsed] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [installedApps, setInstalledApps] = useState<AppInstall[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const { selectedIds, addElement } = useBoardStore();

  const effectiveBoardId = boardId ?? 'demo-board';

  const handlePrompt = async (customPrompt?: string) => {
    const text = customPrompt ?? prompt;
    if (!text.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const actions = await sendAIPrompt(text, effectiveBoardId, 'generate', selectedIds);
      applyActions(actions);
      setResult(`Ação concluída: ${actions.length} passo(s) executado(s).`);
    } catch (err) {
      setResult('Erro ao processar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const applyActions = (actions: AIAction[]) => {
    actions.forEach((action) => {
      switch (action.type) {
        case 'create_elements':
          action.elements?.forEach((el) => addElement(el));
          break;
        case 'update_elements':
          action.updates?.forEach((u) => engine?.updateElement(u.id, u.patch));
          break;
        case 'summary':
          if (action.text) setResult(action.text);
          break;
        case 'suggest_next':
          if (action.suggestions) setResult(`Sugestões: ${action.suggestions.join(', ')}`);
          break;
      }
    });
  };

  const handleQuickAction = async (quickPrompt: string) => {
    setPrompt(quickPrompt);
    await handlePrompt(quickPrompt);
  };

  useEffect(() => {
    const onOpenAI = () => setActiveTab('ai');
    window.addEventListener('orim:openAI', onOpenAI as EventListener);
    return () => window.removeEventListener('orim:openAI', onOpenAI as EventListener);
  }, []);

  useEffect(() => {
    if (activeTab !== 'apps' || !boardId) return;
    setAppsLoading(true);
    getInstalledApps(boardId)
      .then(setInstalledApps)
      .catch(() => setInstalledApps([]))
      .finally(() => setAppsLoading(false));
  }, [activeTab, boardId]);

  if (collapsed) {
    return (
      <div className="right-panel-collapsed">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => {
              setActiveTab(tab.id);
              setCollapsed(false);
            }}
            title={tab.label}
          >
            <tab.icon size={18} />
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="right-panel">
      <div className="panel-tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`panel-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={16} />
            <span>{tab.label}</span>
          </button>
        ))}
        <button className="panel-close" onClick={() => setCollapsed(true)}>
          <X size={14} />
        </button>
      </div>

      <div className="panel-content">
        {activeTab === 'ai' && (
          <div className="ai-panel">
            <div className="ai-header">
              <Sparkles size={18} />
              <h3>Assistente de IA</h3>
            </div>

            <div className="ai-input-area">
              <textarea
                placeholder="O que você gostaria de fazer com este board?"
                rows={3}
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.metaKey) {
                    e.preventDefault();
                    handlePrompt();
                  }
                }}
              />
              <button
                className="ai-send-btn"
                onClick={() => handlePrompt()}
                disabled={loading || !prompt.trim()}
              >
                {loading ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}
                {loading ? 'Gerando...' : 'Gerar'}
              </button>
            </div>

            {result && (
              <div className="ai-result">
                <Sparkles size={14} />
                <p>{result}</p>
              </div>
            )}

            <div className="ai-actions">
              <div className="ai-section-title">Ações rápidas</div>
              {aiQuickActions.map((action) => (
                <button
                  key={action.label}
                  className="ai-action-item"
                  onClick={() => handleQuickAction(action.prompt)}
                  disabled={loading}
                >
                  <action.icon size={16} />
                  <div className="ai-action-info">
                    <span className="ai-action-label">{action.label}</span>
                    <span className="ai-action-desc">{action.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'properties' && <PropertiesPanel engine={engine ?? null} />}

        {activeTab === 'layers' && (
          <div className="layers-panel">
            <div className="panel-empty">Nenhuma camada criada ainda</div>
          </div>
        )}

        {activeTab === 'comments' && (
          <div className="comments-panel">
            <div className="panel-empty">Nenhum comentário no board</div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="history-panel">
            <div className="panel-empty">Histórico de alterações vazio</div>
          </div>
        )}

        {activeTab === 'apps' && (
          <div className="apps-panel">
            <div className="ai-header">
              <Puzzle size={18} />
              <h3>Apps instalados</h3>
            </div>
            {appsLoading && <div className="panel-empty">Carregando…</div>}
            {!appsLoading && installedApps.length === 0 && (
              <div className="panel-empty">
                Nenhum app instalado. Visite o marketplace para instalar.
              </div>
            )}
            <div className="installed-apps-list">
              {installedApps.map((install) => {
                const app = install.app;
                const entryPoint = app.versions[0]?.entryPoint;
                return (
                  <div key={install.id} className="installed-app-item">
                    <div className="installed-app-info">
                      <strong>{app.name}</strong>
                      <span className="app-desc">{app.description}</span>
                    </div>
                    {entryPoint && onOpenApp && (
                      <button
                        className="app-open-btn"
                        onClick={() => onOpenApp(entryPoint, app.id)}
                      >
                        <ExternalLink size={14} />
                        Abrir
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
