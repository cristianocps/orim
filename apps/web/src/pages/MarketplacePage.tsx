import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Check } from 'lucide-react';
import { getApps, installApp, getInstalledApps, type App, type AppInstall } from '../lib/apps.js';
import { useAuth } from '../contexts/AuthContext.js';
import './MarketplacePage.css';

export function MarketplacePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [apps, setApps] = useState<App[]>([]);
  const [installed, setInstalled] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardId, setBoardId] = useState('');

  useEffect(() => {
    getApps()
      .then((data) => {
        setApps(data);
        // Try to get current board from URL or localStorage
        const saved = localStorage.getItem('marketplace_target_board');
        if (saved) setBoardId(saved);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!boardId) return;
    getInstalledApps(boardId)
      .then((data) => setInstalled(new Set(data.map((i) => i.appId))))
      .catch(() => {});
  }, [boardId]);

  const handleInstall = async (appId: string) => {
    if (!boardId) {
      alert('Selecione um board primeiro. Ex: digite um boardId ou vá para um board.');
      return;
    }
    try {
      await installApp(appId, boardId);
      setInstalled((prev) => new Set(prev).add(appId));
    } catch (e: any) {
      setError(e.message);
    }
  };

  return (
    <div className="marketplace-page">
      <header className="marketplace-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
          <span>Voltar</span>
        </button>
        <h1>Marketplace</h1>
        <div className="board-select">
          <label>Instalar no board:</label>
          <input
            type="text"
            placeholder="Board ID"
            value={boardId}
            onChange={(e) => {
              setBoardId(e.target.value);
              localStorage.setItem('marketplace_target_board', e.target.value);
            }}
          />
        </div>
      </header>

      {error && <div className="marketplace-error">{error}</div>}
      {loading && <div className="marketplace-loading">Carregando apps…</div>}

      <div className="apps-grid">
        {apps.map((app) => (
          <div key={app.id} className="app-card">
            <div className="app-icon">
              {app.iconUrl ? (
                <img src={app.iconUrl} alt={app.name} />
              ) : (
                <span>{app.name[0]}</span>
              )}
            </div>
            <div className="app-info">
              <h3>{app.name}</h3>
              <p className="app-desc">{app.description}</p>
              <p className="app-author">por {app.author.name}</p>
              <div className="app-perms">
                {(app.manifest?.permissions ?? []).map((p: string) => (
                  <span key={p} className="perm-tag">{p}</span>
                ))}
              </div>
            </div>
            <button
              className={`install-btn ${installed.has(app.id) ? 'installed' : ''}`}
              onClick={() => handleInstall(app.id)}
              disabled={installed.has(app.id)}
            >
              {installed.has(app.id) ? <Check size={16} /> : <Download size={16} />}
              {installed.has(app.id) ? 'Instalado' : 'Instalar'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
export default MarketplacePage;
