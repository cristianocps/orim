import { useEffect, useRef } from 'react';
import type { CanvasEngine } from '../canvas/engine.js';
import './AppSandbox.css';

interface AppSandboxProps {
  url: string;
  appId: string;
  boardId: string;
  engine: CanvasEngine | null;
  onClose: () => void;
}

export function AppSandbox({ url, appId, boardId, engine, onClose }: AppSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      const { type, payload, id } = event.data ?? {};
      if (!type) return;

      const reply = (data: any) => {
        iframeRef.current?.contentWindow?.postMessage({ ...data, id }, '*');
      };

      switch (type) {
        case 'app:ready': {
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'app:init', payload: { appId, boardId } },
            '*'
          );
          break;
        }
        case 'canvas:getElements': {
          const elements = engine
            ? [] // TODO: expose engine.elements if needed
            : [];
          reply({ type: 'canvas:elements', payload: elements });
          break;
        }
        case 'canvas:createElement': {
          if (engine && payload) {
            engine.createElement(payload);
          }
          reply({ type: 'canvas:ack', payload: { ok: true } });
          break;
        }
        case 'canvas:updateElement': {
          if (engine && payload?.id) {
            engine.updateElement(payload.id, payload.patch);
          }
          reply({ type: 'canvas:ack', payload: { ok: true } });
          break;
        }
        case 'canvas:deleteElement': {
          if (engine && payload?.id) {
            engine.deleteElement(payload.id);
          }
          reply({ type: 'canvas:ack', payload: { ok: true } });
          break;
        }
        case 'canvas:getViewport': {
          const vp = engine?.getViewport() ?? { x: 0, y: 0, zoom: 1 };
          reply({ type: 'canvas:viewport', payload: vp });
          break;
        }
        case 'app:close': {
          onClose();
          break;
        }
      }
    };

    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [url, appId, boardId, engine, onClose]);

  return (
    <div className="app-sandbox-overlay">
      <div className="app-sandbox-container">
        <div className="app-sandbox-header">
          <span className="app-sandbox-title">App</span>
          <button className="app-sandbox-close" onClick={onClose}>
            ×
          </button>
        </div>
        <iframe
          ref={iframeRef}
          src={url}
          className="app-sandbox-frame"
          sandbox="allow-scripts allow-same-origin allow-popups"
          title="App Sandbox"
        />
      </div>
    </div>
  );
}
