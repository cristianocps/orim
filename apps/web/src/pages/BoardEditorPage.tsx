import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { initCanvasEngine, type CanvasEngine, type InlineEditRequest, type ContextMenuRequest, type SelectionInfo } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import { useSocket } from '../hooks/useSocket.js';
import { useBoardSync } from '../hooks/useBoardSync.js';
import { getBoard, flattenElement } from '../lib/api.js';
import { registerBuiltinProviders } from '../canvas/actions/index.js';
import { BoardHeader } from '../components/BoardHeader.js';
import { LeftToolbar } from '../components/LeftToolbar.js';
import { RightPanel } from '../components/RightPanel.js';
import { ZoomControls } from '../components/ZoomControls.js';
import { Minimap } from '../components/Minimap.js';
import { FloatingToolbar } from '../components/FloatingToolbar.js';
import { ContextMenu } from '../components/ContextMenu.js';
import { InlineEditor } from '../components/InlineEditor.js';
import { QuickCreateMenu } from '../components/QuickCreateMenu.js';
import { SaveStatus } from '../components/SaveStatus.js';
import { CommandPalette } from '../components/CommandPalette.js';
import { RemoteCursors } from '../components/RemoteCursors.js';
import { RemoteSelections } from '../components/RemoteSelections.js';
import { CommentPins } from '../components/CommentPins.js';
import { WorkshopTools } from '../components/WorkshopTools.js';
import { PresentationMode } from '../components/PresentationMode.js';
import { ExportPanel } from '../components/ExportPanel.js';
import { AppSandbox } from '../components/AppSandbox.js';
import './BoardEditorPage.css';

interface Comment {
  id: string;
  x: number;
  y: number;
  text: string;
  author: string;
  resolved: boolean;
  replies: { text: string; author: string }[];
}

registerBuiltinProviders();

export function BoardEditorPage() {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<CanvasEngine | null>(null);
  const [canvasEngine, setCanvasEngine] = useState<CanvasEngine | null>(null);
  const [ready, setReady] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [isPresenting, setIsPresenting] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [boardName, setBoardName] = useState('Novo Board');
  const [boardError, setBoardError] = useState<string | null>(null);
  const [activeApp, setActiveApp] = useState<{ url: string; appId: string } | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; targetId: string | null } | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineEditRequest | null>(null);
  const [quickCreate, setQuickCreate] = useState<{ connectorId: string; screenPoint: { x: number; y: number } } | null>(null);
  const {
    setEngine,
    setSelectedIds,
    selectedIds,
    setElements,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useBoardStore();

  const {
    socket,
    onlineUsers,
    followingUserId,
    remoteSelections,
    sendViewport,
    sendSelection,
    startFollowing,
    stopFollowing,
  } = useSocket(boardId);

  const { saveState } = useBoardSync(boardId, canvasEngine, socket);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Stable handler refs so the engine useEffect doesn't tear down/rebuild
  // every time `sendSelection` (and therefore `handleSelect`) changes.
  const handleSelectRef = useRef<(info: SelectionInfo) => void>(() => {});
  const handleContextMenuRef = useRef<(req: ContextMenuRequest) => void>(() => {});
  const handleInlineEditStartRef = useRef<(req: InlineEditRequest) => void>(() => {});
  const handleInlineEditEndRef = useRef<() => void>(() => {});
  const handleConnectorOpenEndRef = useRef<(req: { connectorId: string; screenPoint: { x: number; y: number } }) => void>(() => {});

  handleSelectRef.current = useCallback(
    (info: SelectionInfo) => {
      setSelectedIds(info.ids, info.primaryId);
      sendSelection(info.ids);
    },
    [setSelectedIds, sendSelection],
  );
  handleContextMenuRef.current = useCallback(
    (req: ContextMenuRequest) => {
      setContextMenu({ x: req.screenX, y: req.screenY, targetId: req.targetId });
    },
    [],
  );
  handleInlineEditStartRef.current = useCallback((req: InlineEditRequest) => {
    setInlineEdit(req);
  }, []);
  handleInlineEditEndRef.current = useCallback(() => {
    setInlineEdit(null);
  }, []);
  handleConnectorOpenEndRef.current = useCallback(
    (req: { connectorId: string; screenPoint: { x: number; y: number } }) => {
      setQuickCreate(req);
    },
    [],
  );

  useEffect(() => {
    if (!containerRef.current || !boardId) return;
    const engine = initCanvasEngine(containerRef.current);
    engineRef.current = engine;
    setCanvasEngine(engine);
    setEngine(engine);

    const onSelect = (info: SelectionInfo) => {
      // Diagnostic: confirms the engine that fired the event is the same one
      // useBoardSync wired its persistence listeners to. Mismatched ids here
      // would mean the StrictMode/HMR engine race struck again and clicks
      // are reaching an orphan engine.
      if (typeof window !== 'undefined') {
        try {
          if (window.localStorage.getItem('orim:debug') === '1') {
            console.info('[page] selectionChange', {
              engineId: (engine as any).__engineId,
              ids: info.ids,
              primaryId: info.primaryId,
            });
          }
        } catch { /* ignore */ }
      }
      handleSelectRef.current(info);
    };
    const onContextMenu = (req: ContextMenuRequest) => handleContextMenuRef.current(req);
    const onInlineEditStart = (req: InlineEditRequest) => handleInlineEditStartRef.current(req);
    const onInlineEditEnd = () => handleInlineEditEndRef.current();
    const onConnectorOpenEnd = (req: { connectorId: string; screenPoint: { x: number; y: number } }) =>
      handleConnectorOpenEndRef.current(req);

    engine.on('selectionChange', onSelect);
    engine.on('contextMenu', onContextMenu);
    engine.on('inlineEdit.start', onInlineEditStart);
    engine.on('inlineEdit.end', onInlineEditEnd);
    engine.on('connectorOpenEnd', onConnectorOpenEnd);

    Promise.all([getBoard(boardId), engine.ready])
      .then(([board]) => {
        setBoardName(board.name);
        const elements = (board.elements ?? []).map(flattenElement);
        setElements(elements);
        for (const el of elements.filter((e) => e.type !== 'connector')) {
          engine.createElement(el, { skipEmit: true });
        }
        for (const el of elements.filter((e) => e.type === 'connector')) {
          engine.createElement(el, { skipEmit: true });
        }
        setReady(true);
      })
      .catch((e) => {
        setBoardError(e.message);
        setReady(true);
      });

    return () => {
      engine.off('selectionChange', onSelect);
      engine.off('contextMenu', onContextMenu);
      engine.off('inlineEdit.start', onInlineEditStart);
      engine.off('inlineEdit.end', onInlineEditEnd);
      engine.off('connectorOpenEnd', onConnectorOpenEnd);
      engine.destroy();
      engineRef.current = null;
      setCanvasEngine(null);
      setEngine(null);
    };
  }, [boardId, setEngine, setElements]);

  // Cursor tracking — hard-throttled to ~16Hz (one emit every 60ms). rAF
  // alone (the previous attempt) still allowed up to 60 messages/sec/cursor
  // which the user reported as "still too many". 16Hz is plenty smooth for
  // remote cursor preview while reducing websocket traffic by ~4x.
  // Implements leading-edge + trailing-edge throttle so the first move emits
  // immediately and the very last position is always sent.
  useEffect(() => {
    if (!socket || !canvasEngine) return;
    const engine = canvasEngine;

    const INTERVAL_MS = 60;
    let pending: { x: number; y: number } | null = null;
    let lastSent = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const send = () => {
      if (!pending) return;
      socket.emit('cursor:move', { boardId, x: pending.x, y: pending.y });
      lastSent = performance.now();
      pending = null;
    };

    const trackCursor = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const worldPos = engine.screenToWorld({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      pending = { x: worldPos.x, y: worldPos.y };
      const now = performance.now();
      const elapsed = now - lastSent;
      if (elapsed >= INTERVAL_MS) {
        if (timer !== null) {
          clearTimeout(timer);
          timer = null;
        }
        send();
      } else if (timer === null) {
        timer = setTimeout(() => {
          timer = null;
          send();
        }, INTERVAL_MS - elapsed);
      }
    };

    const el = containerRef.current;
    el?.addEventListener('mousemove', trackCursor);
    return () => {
      el?.removeEventListener('mousemove', trackCursor);
      if (timer !== null) clearTimeout(timer);
    };
  }, [socket, boardId, canvasEngine]);

  // Viewport tracking
  useEffect(() => {
    if (!socket || !canvasEngine || followingUserId) return;
    const engine = canvasEngine;
    let lastVp = engine.getViewport();
    const interval = setInterval(() => {
      const vp = engine.getViewport();
      const dx = Math.abs(vp.x - lastVp.x);
      const dy = Math.abs(vp.y - lastVp.y);
      const dz = Math.abs(vp.zoom - lastVp.zoom);
      if (dx > 5 || dy > 5 || dz > 0.05) {
        sendViewport(vp.x, vp.y, vp.zoom);
        lastVp = vp;
      }
    }, 500);
    return () => clearInterval(interval);
  }, [socket, sendViewport, followingUserId, canvasEngine]);

  // Receive viewport when following
  useEffect(() => {
    if (!socket || !canvasEngine) return;
    const onViewportUpdated = (data: { userId: string; x: number; y: number; zoom: number }) => {
      if (followingUserId && data.userId === followingUserId) {
        canvasEngine.setViewport(data.x, data.y, data.zoom);
      }
    };
    socket.on('viewport.updated', onViewportUpdated);
    return () => {
      socket.off('viewport.updated', onViewportUpdated);
    };
  }, [socket, followingUserId, canvasEngine]);

  // Keyboard shortcuts
  useEffect(() => {
    const isEditingText = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      return ['INPUT', 'TEXTAREA'].includes(target.tagName) || target.isContentEditable;
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isEditingText(e.target)) return;
      const meta = e.metaKey || e.ctrlKey;
      const engine = engineRef.current;

      if (meta && e.key === 'e') {
        e.preventDefault();
        setShowExport(true);
        return;
      }
      if (meta && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette((v) => !v);
        return;
      }
      if (e.key === 'n' && !meta) {
        engine?.addRandomShape('sticky_note');
      } else if (e.key === 't' && !meta) {
        engine?.addRandomShape('text');
      } else if (e.key === 'r' && !meta) {
        engine?.addRandomShape('rectangle');
      } else if (e.key === 'o' && !meta) {
        engine?.addRandomShape('circle');
      } else if (e.key === 'f' && !meta) {
        engine?.addRandomShape('frame');
      } else if (e.key === 'l' && !meta) {
        engine?.startConnectorMode();
      } else if (meta && e.key === 'd') {
        e.preventDefault();
        for (const id of selectedIds) {
          const cloned = engine?.duplicateElement(id);
          if (cloned) useBoardStore.getState().addElement(cloned);
        }
      } else if (meta && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        for (const id of selectedIds) {
          const el = useBoardStore.getState().getElement(id);
          if (!el) continue;
          useBoardStore
            .getState()
            .updateElement(id, { metadata: { ...el.metadata, locked: !el.metadata?.locked } });
        }
      } else if (meta && e.key === 'g' && !e.shiftKey) {
        e.preventDefault();
        const groupId = engine?.groupSelection();
        if (groupId) {
          for (const id of selectedIds) {
            const el = useBoardStore.getState().getElement(id);
            if (!el) continue;
            useBoardStore
              .getState()
              .updateElement(id, { metadata: { ...el.metadata, groupId } });
          }
        }
      } else if (meta && e.key === 'g' && e.shiftKey) {
        e.preventDefault();
        engine?.ungroupSelection();
        for (const id of selectedIds) {
          const el = useBoardStore.getState().getElement(id);
          if (!el) continue;
          useBoardStore
            .getState()
            .updateElement(id, { metadata: { ...el.metadata, groupId: null } });
        }
      } else if (meta && e.key === ']') {
        e.preventDefault();
        for (const id of selectedIds) engine?.bringToFront(id);
      } else if (meta && e.key === '[') {
        e.preventDefault();
        for (const id of selectedIds) engine?.sendToBack(id);
      } else if (meta && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey ? canRedo() : canUndo()) {
          if (e.shiftKey) redo();
          else undo();
        }
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        for (const id of selectedIds) useBoardStore.getState().removeElement(id);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const focus = selectedIds[0];
        if (focus) engine?.beginInlineEdit(focus);
      } else if (e.key === 'Escape') {
        if (engine?.getSelection().ids.length) engine.setSelection([]);
        engine?.endConnectorMode();
        engine?.endDrawingMode();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [canUndo, canRedo, undo, redo, selectedIds]);

  const handleAddComment = (x: number, y: number, text: string) => {
    setComments((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        x,
        y,
        text,
        author: 'Você',
        resolved: false,
        replies: [],
      },
    ]);
  };

  const handleResolveComment = (id: string) => {
    setComments((prev) =>
      prev.map((c) => (c.id === id ? { ...c, resolved: !c.resolved } : c)),
    );
  };

  return (
    <div className="board-editor">
      <BoardHeader
        boardName={boardName}
        onBack={() => navigate('/')}
        onPresent={() => setIsPresenting(true)}
        onlineUsers={onlineUsers}
        followingUserId={followingUserId}
        onFollowUser={startFollowing}
        onStopFollowing={stopFollowing}
      />

      <div className="editor-body">
        <LeftToolbar engine={canvasEngine} />

        <div className="canvas-area">
          <div ref={containerRef} className="canvas-container" />

          <RemoteCursors socket={socket} />
          <RemoteSelections engine={canvasEngine} selections={remoteSelections} />

          <CommentPins
            comments={comments}
            onAddComment={handleAddComment}
            onResolve={handleResolveComment}
          />

          <FloatingToolbar engine={canvasEngine} />

          <ContextMenu
            engine={canvasEngine}
            open={contextMenu}
            onClose={() => setContextMenu(null)}
          />

          <InlineEditor
            engine={canvasEngine}
            request={inlineEdit}
            onClose={() => setInlineEdit(null)}
          />

          <QuickCreateMenu
            engine={canvasEngine}
            open={quickCreate}
            onClose={() => setQuickCreate(null)}
          />

          <SaveStatus state={saveState} />

          <WorkshopTools
            onTimerStart={(seconds) => console.log('Timer started:', seconds)}
            onVote={(targetId) => console.log('Voted on:', targetId)}
          />
          <ZoomControls engine={canvasEngine} />
          <Minimap engine={canvasEngine} />
        </div>

        {!isMobile && (
          <RightPanel
            engine={canvasEngine}
            boardId={boardId}
            onOpenApp={(url, appId) => setActiveApp({ url, appId })}
          />
        )}
      </div>

      {isPresenting && (
        <PresentationMode
          engine={canvasEngine}
          frames={[
            { id: 'f1', x: 0, y: 0, width: 800, height: 600, title: 'Introdução' },
            { id: 'f2', x: 1000, y: 0, width: 800, height: 600, title: 'Detalhes' },
          ]}
          onClose={() => setIsPresenting(false)}
        />
      )}

      {showExport && (
        <ExportPanel engine={canvasEngine} onClose={() => setShowExport(false)} />
      )}

      {showCommandPalette && (
        <CommandPalette
          onClose={() => setShowCommandPalette(false)}
          engine={canvasEngine}
        />
      )}

      {activeApp && boardId && (
        <AppSandbox
          url={activeApp.url}
          appId={activeApp.appId}
          boardId={boardId}
          engine={canvasEngine}
          onClose={() => setActiveApp(null)}
        />
      )}

      {!ready && (
        <div className="editor-loading">
          <div className="loading-spinner" />
          <span>Carregando canvas…</span>
        </div>
      )}

      {boardError && (
        <div className="editor-loading">
          <span>Erro ao carregar: {boardError}</span>
        </div>
      )}
    </div>
  );
}
export default BoardEditorPage;
