import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search, Star, LayoutGrid } from 'lucide-react';
import './TemplatesPage.css';

const categories = [
  { name: 'Brainstorming', icon: '💡', color: '#fef3c7', count: 24 },
  { name: 'Design Thinking', icon: '🎨', color: '#fce7f3', count: 18 },
  { name: 'Product Discovery', icon: '🔍', color: '#dbeafe', count: 15 },
  { name: 'Roadmap', icon: '🗺️', color: '#d1fae5', count: 12 },
  { name: 'Kanban', icon: '📋', color: '#fef3c7', count: 10 },
  { name: 'Retrospectiva', icon: '🔄', color: '#fce7f3', count: 14 },
  { name: 'Fluxograma', icon: '➡️', color: '#dbeafe', count: 20 },
  { name: 'Jornada do Cliente', icon: '🛤️', color: '#d1fae5', count: 8 },
  { name: 'Matriz Impacto x Esforço', icon: '📊', color: '#fef3c7', count: 6 },
  { name: 'Planejamento Estratégico', icon: '🎯', color: '#fce7f3', count: 11 },
  { name: 'Arquitetura de Software', icon: '🏗️', color: '#dbeafe', count: 9 },
  { name: 'Business Model Canvas', icon: '💼', color: '#d1fae5', count: 7 },
];

const featuredTemplates = [
  { id: 't1', name: 'Brainstorming Clássico', category: 'Brainstorming', uses: 12500 },
  { id: 't2', name: 'Roadmap Trimestral', category: 'Roadmap', uses: 8900 },
  { id: 't3', name: 'Retrospectiva Starfish', category: 'Retrospectiva', uses: 6700 },
  { id: 't4', name: 'Kanban Simples', category: 'Kanban', uses: 10200 },
];

export function TemplatesPage() {
  const navigate = useNavigate();

  return (
    <div className="templates-page">
      <header className="templates-header">
        <button className="back-btn" onClick={() => navigate('/')}>
          <ArrowLeft size={20} />
        </button>
        <h1>Biblioteca de Templates</h1>
      </header>

      <div className="templates-search">
        <Search size={18} />
        <input type="text" placeholder="Buscar templates..." />
      </div>

      <section className="templates-section">
        <h2>Destaques</h2>
        <div className="featured-grid">
          {featuredTemplates.map((t) => (
            <div key={t.id} className="template-card">
              <div className="template-preview">
                <LayoutGrid size={32} />
              </div>
              <div className="template-info">
                <h3>{t.name}</h3>
                <span className="template-category">{t.category}</span>
                <div className="template-meta">
                  <Star size={12} />
                  <span>{t.uses.toLocaleString()} usos</span>
                </div>
              </div>
              <button className="use-template-btn">Usar template</button>
            </div>
          ))}
        </div>
      </section>

      <section className="templates-section">
        <h2>Categorias</h2>
        <div className="categories-grid">
          {categories.map((cat) => (
            <div key={cat.name} className="category-card" style={{ background: cat.color }}>
              <span className="category-icon">{cat.icon}</span>
              <div className="category-info">
                <h3>{cat.name}</h3>
                <span>{cat.count} templates</span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
export default TemplatesPage;
