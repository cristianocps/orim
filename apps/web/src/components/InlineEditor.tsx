import { useEffect, useRef, useState } from 'react';
import type { CanvasEngine, InlineEditRequest } from '../canvas/engine.js';
import './InlineEditor.css';

interface InlineEditorProps {
  engine: CanvasEngine | null;
  request: InlineEditRequest | null;
  onClose: () => void;
}

export function InlineEditor({ engine, request, onClose }: InlineEditorProps) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const [value, setValue] = useState(request?.initialValue ?? '');

  useEffect(() => {
    setValue(request?.initialValue ?? '');
  }, [request?.initialValue, request?.id]);

  useEffect(() => {
    if (!request) return;
    const el = ref.current;
    if (el) {
      el.focus();
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
        el.select();
      }
    }
  }, [request?.id]);

  if (!request || !engine) return null;

  const commit = (next?: string) => {
    engine.endInlineEdit(true, next ?? value);
    onClose();
  };
  const cancel = () => {
    engine.endInlineEdit(false);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Enter' && !e.shiftKey && !request.multiline) {
      e.preventDefault();
      commit();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && request.multiline) {
      e.preventDefault();
      commit();
    }
  };

  const style: React.CSSProperties = {
    position: 'fixed',
    left: request.bounds.x,
    top: request.bounds.y,
    width: request.bounds.width,
    height: request.bounds.height,
    fontSize: request.fontSize,
  };

  return (
    <div
      className="inline-editor-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) commit();
      }}
    >
      {request.multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          className="inline-editor"
          style={style}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKeyDown}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          className="inline-editor"
          style={style}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={onKeyDown}
        />
      )}
    </div>
  );
}
