import { useState, useEffect, useRef } from 'react';
import { Search, StickyNote, Type, Square, Circle, Frame, Sparkles, LayoutTemplate } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import './CommandPalette.css';

interface CommandPaletteProps {
  onClose: () => void;
  engine: CanvasEngine | null;
}

const commands = [
  { id: 'sticky', label: 'Criar Sticky Note', icon: StickyNote, shortcut: 'N', action: 'sticky_note' },
  { id: 'text', label: 'Criar Texto', icon: Type, shortcut: 'T', action: 'text' },
  { id: 'rect', label: 'Criar Retângulo', icon: Square, shortcut: 'R', action: 'rectangle' },
  { id: 'circle', label: 'Criar Círculo', icon: Circle, shortcut: 'O', action: 'circle' },
  { id: 'frame', label: 'Criar Frame', icon: Frame, shortcut: 'F', action: 'frame' },
  { id: 'template', label: 'Inserir Template', icon: LayoutTemplate, shortcut: '', action: 'template' },
  { id: 'ai', label: 'Ação de IA', icon: Sparkles, shortcut: '', action: 'ai' },
];

export function CommandPalette({ onClose, engine }: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cmd = filtered[selectedIndex];
        if (cmd && cmd.action) {
          if (cmd.action === 'template' || cmd.action === 'ai') {
            // TODO: open respective panels
          } else {
            engine?.addRandomShape(cmd.action as any);
          }
          onClose();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [filtered, selectedIndex, engine, onClose]);

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette" onClick={(e) => e.stopPropagation()}>
        <div className="palette-search">
          <Search size={18} />
          <input
            ref={inputRef}
            type="text"
            placeholder="Digite um comando..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="palette-results">
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              className={`palette-item ${idx === selectedIndex ? 'selected' : ''}`}
              onClick={() => {
                if (cmd.action === 'template' || cmd.action === 'ai') {
                  // TODO
                } else {
                  engine?.addRandomShape(cmd.action as any);
                }
                onClose();
              }}
            >
              <cmd.icon size={16} />
              <span className="palette-label">{cmd.label}</span>
              {cmd.shortcut && <span className="palette-shortcut">{cmd.shortcut}</span>}
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="palette-empty">Nenhum comando encontrado</div>
          )}
        </div>
      </div>
    </div>
  );
}
