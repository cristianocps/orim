import { useState } from 'react';
import { ZoomIn, ZoomOut, Maximize2, Grid3x3 } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import './ZoomControls.css';

interface ZoomControlsProps {
  engine: CanvasEngine | null;
}

export function ZoomControls({ engine }: ZoomControlsProps) {
  const zoom = engine?.getViewport().zoom ?? 1;
  const percent = Math.round(zoom * 100);
  const [snapEnabled, setSnapEnabled] = useState(false);

  const toggleSnap = () => {
    const next = !snapEnabled;
    setSnapEnabled(next);
    engine?.toggleSnapToGrid(next);
  };

  return (
    <div className="zoom-controls">
      <button className="zoom-btn" onClick={() => {
        const v = engine?.getViewport();
        if (v) engine?.setViewport(v.x, v.y, Math.max(0.1, v.zoom / 1.2));
      }}>
        <ZoomOut size={16} />
      </button>
      <span className="zoom-percent">{percent}%</span>
      <button className="zoom-btn" onClick={() => {
        const v = engine?.getViewport();
        if (v) engine?.setViewport(v.x, v.y, Math.min(10, v.zoom * 1.2));
      }}>
        <ZoomIn size={16} />
      </button>
      <button className="zoom-btn" onClick={() => engine?.setViewport(0, 0, 1)}>
        <Maximize2 size={16} />
      </button>
      <div className="zoom-sep" />
      <button
        className={`zoom-btn ${snapEnabled ? 'active' : ''}`}
        onClick={toggleSnap}
        title="Snap to grid"
      >
        <Grid3x3 size={16} />
      </button>
    </div>
  );
}
