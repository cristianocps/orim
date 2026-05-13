import { useState } from 'react';
import { Download, Image as ImageIcon, FileText, X } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import './ExportPanel.css';

interface ExportPanelProps {
  engine: CanvasEngine | null;
  onClose: () => void;
}

export function ExportPanel({ engine, onClose }: ExportPanelProps) {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!engine || exporting) return;
    setExporting(true);

    try {
      if (format === 'png') {
        const canvas = engine.app.canvas as HTMLCanvasElement;
        const link = document.createElement('a');
        link.download = `orim-board-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
      onClose();
    }
  };

  return (
    <div className="export-overlay" onClick={onClose}>
      <div className="export-panel" onClick={(e) => e.stopPropagation()}>
        <div className="export-header">
          <h3>Exportar Board</h3>
          <button className="export-close" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        <div className="export-options">
          <button
            className={`export-option ${format === 'png' ? 'active' : ''}`}
            onClick={() => setFormat('png')}
          >
            <ImageIcon size={24} />
            <span>PNG</span>
            <span className="export-desc">Imagem de alta qualidade</span>
          </button>
          <button
            className={`export-option ${format === 'svg' ? 'active' : ''}`}
            onClick={() => setFormat('svg')}
            disabled
          >
            <FileText size={24} />
            <span>SVG</span>
            <span className="export-desc">Em breve</span>
          </button>
        </div>

        <button
          className="export-btn"
          onClick={handleExport}
          disabled={exporting}
        >
          <Download size={16} />
          {exporting ? 'Exportando...' : 'Exportar'}
        </button>
      </div>
    </div>
  );
}
