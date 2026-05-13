import type { ElementRenderer } from './types.js';

class RendererRegistry {
  private map = new Map<string, ElementRenderer>();

  register(type: string, renderer: ElementRenderer) {
    this.map.set(type, renderer);
  }

  unregister(type: string) {
    this.map.delete(type);
  }

  get(type: string): ElementRenderer | undefined {
    return this.map.get(type);
  }

  has(type: string): boolean {
    return this.map.has(type);
  }

  types(): string[] {
    return Array.from(this.map.keys());
  }
}

export const rendererRegistry = new RendererRegistry();
