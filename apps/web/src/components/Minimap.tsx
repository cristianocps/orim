import { useEffect, useRef } from 'react';
import type { CanvasEngine } from '../canvas/engine.js';
import './Minimap.css';

interface MinimapProps {
  engine: CanvasEngine | null;
}

export function Minimap({ engine }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!engine || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let rafId = 0;
    let cancelled = false;

    const draw = () => {
      if (cancelled) return;
      const screen = engine.app?.screen;
      if (!screen) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      const w = canvas.width;
      const h = canvas.height;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 0.5;
      for (let x = 0; x < w; x += 10) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = 0; y < h; y += 10) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      const vp = engine.getViewport();
      const scale = 0.05;
      const vw = (screen.width * scale) / vp.zoom;
      const vh = (screen.height * scale) / vp.zoom;
      const vx = w / 2 + vp.x * scale - vw / 2;
      const vy = h / 2 + vp.y * scale - vh / 2;

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.strokeRect(vx, vy, vw, vh);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [engine]);

  return (
    <div className="minimap">
      <canvas ref={canvasRef} width={160} height={120} />
    </div>
  );
}
