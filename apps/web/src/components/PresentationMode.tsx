import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, ChevronLeft, ChevronRight, X, Monitor, Users } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import './PresentationMode.css';

interface Frame {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  title: string;
}

interface PresentationModeProps {
  engine: CanvasEngine | null;
  frames: Frame[];
  onClose: () => void;
}

export function PresentationMode({ engine, frames, onClose }: PresentationModeProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [syncViewers, setSyncViewers] = useState(true);
  const navigate = useNavigate();

  const currentFrame = frames[currentIndex];

  useEffect(() => {
    if (!engine || !currentFrame) return;
    engine.setViewport(
      currentFrame.x,
      currentFrame.y,
      Math.min(
        engine.app.screen.width / currentFrame.width,
        engine.app.screen.height / currentFrame.height
      ) * 0.9
    );
  }, [engine, currentFrame]);

  const goNext = () => {
    if (currentIndex < frames.length - 1) setCurrentIndex(currentIndex + 1);
  };

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex(currentIndex - 1);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') goNext();
      if (e.key === 'ArrowLeft') goPrev();
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [currentIndex, frames.length]);

  if (!currentFrame) {
    return (
      <div className="presentation-overlay">
        <div className="presentation-empty">
          <Monitor size={48} />
          <h2>Nenhum frame encontrado</h2>
          <p>Crie frames no board para usar o modo apresentação.</p>
          <button className="presentation-close-btn" onClick={onClose}>
            <X size={18} />
            Fechar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="presentation-overlay">
      <div className="presentation-controls top">
        <div className="presentation-info">
          <span className="frame-number">
            {currentIndex + 1} / {frames.length}
          </span>
          <span className="frame-title">{currentFrame.title}</span>
        </div>
        <div className="presentation-actions">
          <button
            className={`pres-action ${syncViewers ? 'active' : ''}`}
            onClick={() => setSyncViewers(!syncViewers)}
          >
            <Users size={16} />
            {syncViewers ? 'Sincronizado' : 'Não sincronizado'}
          </button>
          <button className="pres-action" onClick={onClose}>
            <X size={16} />
            Sair
          </button>
        </div>
      </div>

      <div className="presentation-nav">
        <button
          className="nav-arrow"
          onClick={goPrev}
          disabled={currentIndex === 0}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          className="nav-arrow"
          onClick={goNext}
          disabled={currentIndex === frames.length - 1}
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="presentation-progress">
        <div
          className="progress-bar"
          style={{ width: `${((currentIndex + 1) / frames.length) * 100}%` }}
        />
      </div>
    </div>
  );
}
