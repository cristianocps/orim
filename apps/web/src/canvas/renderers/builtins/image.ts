import { Container, Graphics, Sprite, Assets, Text, TextStyle } from 'pixi.js';
import type { ElementRenderer } from '../types.js';

export const renderImage: ElementRenderer = (el) => {
  const container = new Container();
  const url = (el as any).url ?? (el.style?.url as string) ?? '';
  const size = (el as any).size ?? { width: 240, height: 180 };

  // Placeholder while loading
  const placeholder = new Graphics();
  placeholder.roundRect(-size.width / 2, -size.height / 2, size.width, size.height, 6);
  placeholder.fill({ color: 0xf1f5f9 });
  placeholder.stroke({ width: 1, color: 0xe2e8f0 });
  container.addChild(placeholder);

  const loadingText = new Text({
    text: url ? 'Carregando…' : 'Sem imagem',
    style: new TextStyle({ fontSize: 12, fill: 0x94a3b8, fontStyle: 'italic' }),
  });
  loadingText.anchor.set(0.5);
  container.addChild(loadingText);

  if (url) {
    Assets.load(url)
      .then((tex) => {
        if (container.destroyed) return;
        placeholder.destroy();
        loadingText.destroy();
        const sprite = new Sprite(tex);
        sprite.anchor.set(0.5);
        const scale = Math.min(size.width / sprite.width, size.height / sprite.height);
        sprite.scale.set(scale);
        container.addChild(sprite);
      })
      .catch(() => {
        if (container.destroyed) return;
        loadingText.text = 'Erro ao carregar';
      });
  }

  return container;
};
