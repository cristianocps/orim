import { useRef, useState } from 'react';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import './ImageUploader.css';

interface ImageUploaderProps {
  engine: CanvasEngine | null;
}

export function ImageUploader({ engine }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { addElement } = useBoardStore();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engine) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      const data = await res.json();
      if (!data.url) throw new Error('Upload failed');
      const vp = engine.getViewport();
      const id = crypto.randomUUID();
      const el: any = {
        id,
        type: 'image',
        url: data.url,
        size: { width: 320, height: 240 },
        transform: {
          x: vp.x,
          y: vp.y,
          rotation: 0,
          scaleX: 1,
          scaleY: 1,
        },
        style: {},
        metadata: {},
        createdBy: 'local-user',
        updatedAt: new Date().toISOString(),
      };
      engine.createElement(el);
      addElement(el, true);
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleUpload}
        style={{ display: 'none' }}
      />
      <button
        className="toolbar-tool"
        onClick={() => inputRef.current?.click()}
        title="Upload imagem"
        disabled={uploading}
      >
        {uploading ? <Loader2 size={20} className="spin" /> : <ImageIcon size={20} />}
      </button>
    </>
  );
}
