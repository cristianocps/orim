import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';

interface ToolbarProps {
  engine: CanvasEngine | null;
}

export function Toolbar({ engine }: ToolbarProps) {
  const { selectedIds, removeElement } = useBoardStore();

  const addRect = () => engine?.addRandomShape('rectangle');
  const addCircle = () => engine?.addRandomShape('circle');
  const addSticky = () => engine?.addRandomShape('sticky_note');
  const addText = () => engine?.addRandomShape('text');
  const handleDelete = () => {
    selectedIds.forEach((id) => removeElement(id));
  };

  return (
    <div className="toolbar">
      <button onClick={addRect} title="Rectangle">
        ⬜
      </button>
      <button onClick={addCircle} title="Circle">
        ⭕
      </button>
      <button onClick={addSticky} title="Sticky Note">
        📝
      </button>
      <button onClick={addText} title="Text">
        T
      </button>
      <div className="spacer" />
      {selectedIds.length > 0 && (
        <button onClick={handleDelete} title="Delete" className="danger">
          🗑️
        </button>
      )}
    </div>
  );
}
