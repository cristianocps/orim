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
    const finalValue = next ?? value;
    // No-op commits MUST NOT round-trip through the engine. Otherwise,
    // the slightest mismatch in fallback semantics between the renderer
    // and the engine — e.g. renderer treats `undefined` as 'Texto' while
    // the editor treats `undefined` as '' — would cause the displayed
    // text to silently flip to '' when the user opens and closes the
    // editor without typing. Skipping the patch when nothing changed
    // both fixes that class of bug AND saves a network round-trip.
    if (finalValue === (request.initialValue ?? '')) {
      engine.endInlineEdit(false);
    } else {
      engine.endInlineEdit(true, finalValue);
    }
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
    fontWeight: request.fontWeight ?? 500,
    fontStyle: request.fontStyle ?? 'normal',
    fontFamily: request.fontFamily ?? 'inherit',
    textAlign: request.textAlign ?? 'center',
    color: request.color ?? '#0f172a',
    // Mirror the underlying fill so the editor visually replaces the rendered
    // text (otherwise editing a dark sticky note shows white text on white).
    background: request.background ?? 'white',
  };

  // No backdrop. Earlier we used a `position: fixed; inset: 0` overlay to
  // capture click-outside-to-commit, but it ate every click destined for
  // the canvas. Switching to another element required FOUR clicks (one to
  // commit, two more for the real double-click, plus a recovery click)
  // because the first "select B" click was always swallowed by the
  // backdrop. Now we rely entirely on the textarea/input's `onBlur` —
  // clicking anywhere else (canvas, another element, sidebar) blurs the
  // editor and commits naturally, while the click also reaches its real
  // target so the user can immediately interact with the new element.
  //
  // Side benefit: the FloatingToolbar's `mousedown preventDefault` keeps
  // focus, so clicking Bold/Italic etc. doesn't trigger blur and the
  // editor stays open while formatting is applied.
  return request.multiline ? (
    <textarea
      ref={ref as React.RefObject<HTMLTextAreaElement>}
      className="inline-editor"
      style={style}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => commit()}
      onKeyDown={onKeyDown}
      // stop the canvas from receiving the mousedown that lands inside the
      // editor itself — without this, dragging-to-select inside the editor
      // would bubble through and start a selection-rectangle on the canvas.
      onMouseDown={(e) => e.stopPropagation()}
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
      onMouseDown={(e) => e.stopPropagation()}
    />
  );
}
