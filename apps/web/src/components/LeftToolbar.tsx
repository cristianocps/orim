import { useState, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  MousePointer2,
  Hand,
  StickyNote,
  Type,
  Square,
  Circle,
  Minus,
  PenTool,
  Frame,
  MessageSquare,
  Image as ImageIcon,
  LayoutTemplate,
  Puzzle,
  Sparkles,
  CreditCard,
  Table,
  Highlighter,
  Eraser,
} from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import './LeftToolbar.css';

interface LeftToolbarProps {
  engine: CanvasEngine | null;
}

interface ToolItem {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut: string;
}

interface ToolSeparator {
  id: 'separator';
}

type Tool = ToolItem | ToolSeparator;

const tools: Tool[] = [
  { id: 'select', icon: MousePointer2, label: 'Selecionar', shortcut: 'V' },
  { id: 'pan', icon: Hand, label: 'Mover (Alt+arrastar)', shortcut: 'H' },
  { id: 'separator' },
  { id: 'sticky', icon: StickyNote, label: 'Sticky Note', shortcut: 'N' },
  { id: 'text', icon: Type, label: 'Texto', shortcut: 'T' },
  { id: 'rectangle', icon: Square, label: 'Retângulo', shortcut: 'R' },
  { id: 'circle', icon: Circle, label: 'Círculo', shortcut: 'O' },
  { id: 'connector', icon: Minus, label: 'Conector', shortcut: 'L' },
  { id: 'pen', icon: PenTool, label: 'Caneta', shortcut: 'P' },
  { id: 'highlighter', icon: Highlighter, label: 'Marca-texto', shortcut: '' },
  { id: 'eraser', icon: Eraser, label: 'Borracha', shortcut: '' },
  { id: 'separator' },
  { id: 'frame', icon: Frame, label: 'Frame', shortcut: 'F' },
  { id: 'card', icon: CreditCard, label: 'Card', shortcut: '' },
  { id: 'table', icon: Table, label: 'Tabela', shortcut: '' },
  { id: 'comment', icon: MessageSquare, label: 'Comentário', shortcut: 'C' },
  { id: 'image', icon: ImageIcon, label: 'Upload', shortcut: '' },
  { id: 'separator' },
  { id: 'template', icon: LayoutTemplate, label: 'Templates', shortcut: '' },
  { id: 'app', icon: Puzzle, label: 'Apps', shortcut: '' },
  { id: 'ai', icon: Sparkles, label: 'IA', shortcut: '' },
];

export function LeftToolbar({ engine }: LeftToolbarProps) {
  const [activeTool, setActiveTool] = useState('select');
  const inputRef = useRef<HTMLInputElement>(null);
  const { addElement } = useBoardStore();

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engine) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.url) return;
      const el = engine.insertElementAt('image', undefined, {
        ...({} as any),
        url: data.url,
        size: { width: 320, height: 240 },
      } as any);
      if (el) addElement(el, true);
    } catch {
      // ignore upload errors
    } finally {
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const handleToolClick = (toolId: string) => {
    setActiveTool(toolId);
    engine?.endConnectorMode();
    engine?.endDrawingMode();

    switch (toolId) {
      case 'sticky':
      case 'text':
      case 'rectangle':
      case 'circle':
      case 'frame':
      case 'card':
      case 'table': {
        const el = engine?.insertElementAt(toolId === 'sticky' ? 'sticky_note' : toolId);
        if (el) {
          addElement(el, true);
          engine?.setSelection([el.id]);
        }
        setActiveTool('select');
        break;
      }
      case 'connector':
        engine?.startConnectorMode();
        break;
      case 'pen':
        engine?.startDrawingMode({ color: 0x1e293b, width: 2, mode: 'pen' });
        break;
      case 'highlighter':
        engine?.startDrawingMode({ color: 0xfacc15, width: 6, mode: 'highlighter' });
        break;
      case 'eraser':
        engine?.startDrawingMode({ color: 0xf8fafc, width: 12, mode: 'eraser' });
        break;
      case 'image':
        inputRef.current?.click();
        setActiveTool('select');
        break;
      case 'ai':
        window.dispatchEvent(new CustomEvent('orim:openAI', { detail: {} }));
        setActiveTool('select');
        break;
      case 'comment':
        window.dispatchEvent(new CustomEvent('orim:addCommentMode', { detail: {} }));
        break;
      case 'select':
      case 'pan':
      default:
        break;
    }
  };

  const isToolItem = (tool: Tool): tool is ToolItem => tool.id !== 'separator';

  return (
    <div className="left-toolbar">
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleImageUpload}
      />
      {tools.map((tool, idx) =>
        !isToolItem(tool) ? (
          <div key={`sep-${idx}`} className="toolbar-separator" />
        ) : (
          <button
            key={tool.id}
            className={`toolbar-tool ${activeTool === tool.id ? 'active' : ''}`}
            onClick={() => handleToolClick(tool.id)}
            title={`${tool.label}${tool.shortcut ? ` (${tool.shortcut})` : ''}`}
          >
            <tool.icon size={20} />
          </button>
        )
      )}
    </div>
  );
}
