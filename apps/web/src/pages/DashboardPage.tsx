import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutGrid,
  Star,
  Clock,
  Users,
  Settings,
  Plus,
  Search,
  MoreHorizontal,
  ChevronDown,
  Sparkles,
  FolderOpen,
  LogOut,
  Puzzle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext.js';
import { getBoards, createBoard, type Board } from '../lib/api.js';
import './DashboardPage.css';

const workspaces = [
  { id: '1', name: 'Pessoal', icon: 'P', color: '#3b82f6' },
  { id: '2', name: 'Equipe de Produto', icon: 'E', color: '#10b981' },
];

const templateCategories = [
  { name: 'Brainstorming', icon: '💡', color: '#fef3c7' },
  { name: 'Roadmap', icon: '🗺️', color: '#dbeafe' },
  { name: 'Retrospectiva', icon: '🔄', color: '#fce7f3' },
  { name: 'Kanban', icon: '📋', color: '#d1fae5' },
];

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `${minutes}min atrás`;
  if (hours < 24) return `${hours}h atrás`;
  if (days < 7) return `${days} dia${days > 1 ? 's' : ''} atrás`;
  return new Date(date).toLocaleDateString('pt-BR');
}

export function DashboardPage() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [activeWorkspace, setActiveWorkspace] = useState('2');
  const [searchQuery, setSearchQuery] = useState('');
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getBoards()
      .then(setBoards)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const handleNewBoard = async () => {
    try {
      const board = await createBoard('Novo Board');
      navigate(`/board/${board.id}`);
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="dashboard">
      {/* Sidebar */}
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">O</div>
            <span>Orim</span>
          </div>
        </div>

        <div className="sidebar-section">
          <button className="new-board-btn" onClick={handleNewBoard}>
            <Plus size={18} />
            <span>Novo board</span>
          </button>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-label">Workspaces</div>
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              className={`workspace-item ${activeWorkspace === ws.id ? 'active' : ''}`}
              onClick={() => setActiveWorkspace(ws.id)}
            >
              <div className="workspace-icon" style={{ background: ws.color }}>
                {ws.icon}
              </div>
              <span>{ws.name}</span>
              <ChevronDown size={14} className="workspace-chevron" />
            </button>
          ))}
        </div>

        <nav className="sidebar-nav">
          <a href="#" className="nav-item active">
            <LayoutGrid size={18} />
            <span>Boards</span>
          </a>
          <a href="#" className="nav-item">
            <Star size={18} />
            <span>Favoritos</span>
          </a>
          <a href="#" className="nav-item">
            <Clock size={18} />
            <span>Recentes</span>
          </a>
          <a href="#" className="nav-item">
            <Users size={18} />
            <span>Compartilhados</span>
          </a>
          <a href="#" className="nav-item">
            <FolderOpen size={18} />
            <span>Projetos</span>
          </a>
          <button className="nav-item" onClick={() => navigate('/marketplace')}>
            <Puzzle size={18} />
            <span>Marketplace</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <button className="nav-item">
            <Settings size={18} />
            <span>Configurações</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="dashboard-main">
        {/* Header */}
        <header className="dashboard-header">
          <div className="header-search">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Buscar boards, templates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="header-actions">
            <button className="header-btn" onClick={() => navigate('/templates')}>
              <Sparkles size={18} />
              <span>Templates</span>
            </button>
            <div className="header-actions">
            <span className="header-user">{user?.name ?? 'Convidado'}</span>
            <button className="header-btn" onClick={() => logout().then(() => navigate('/login'))}>
              <LogOut size={18} />
            </button>
          </div>
          </div>
        </header>

        {/* Content */}
        <div className="dashboard-content">
          {/* Quick Start */}
          <section className="section">
            <h2 className="section-title">Comece algo novo</h2>
            <div className="quick-start-grid">
              <button className="quick-card primary" onClick={handleNewBoard}>
                <Plus size={24} />
                <span>Board em branco</span>
              </button>
              <button className="quick-card" onClick={() => navigate('/templates')}>
                <Sparkles size={24} />
                <span>Usar template</span>
              </button>
              <button className="quick-card">
                <Sparkles size={24} />
                <span>Gerar com IA</span>
              </button>
            </div>
          </section>

          {/* Recent Boards */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Meus boards</h2>
            </div>
            {loading && <div className="boards-loading">Carregando…</div>}
            {error && <div className="boards-error">{error}</div>}
            {!loading && !error && boards.length === 0 && (
              <div className="boards-empty">Nenhum board ainda. Crie o primeiro!</div>
            )}
            <div className="boards-grid">
              {boards.map((board) => (
                <div
                  key={board.id}
                  className="board-card"
                  onClick={() => navigate(`/board/${board.id}`)}
                >
                  <div className="board-thumbnail">
                    <div className="board-thumbnail-placeholder">
                      <LayoutGrid size={32} />
                    </div>
                  </div>
                  <div className="board-info">
                    <h3>{board.name}</h3>
                    <div className="board-meta">
                      <span>{timeAgo(board.updatedAt)}</span>
                    </div>
                  </div>
                  <button className="board-more">
                    <MoreHorizontal size={16} />
                  </button>
                </div>
              ))}
            </div>
          </section>

          {/* Templates */}
          <section className="section">
            <div className="section-header">
              <h2 className="section-title">Templates populares</h2>
              <button className="text-btn" onClick={() => navigate('/templates')}>
                Ver biblioteca
              </button>
            </div>
            <div className="templates-row">
              {templateCategories.map((cat) => (
                <div key={cat.name} className="template-chip" style={{ background: cat.color }}>
                  <span>{cat.icon}</span>
                  <span>{cat.name}</span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
