import { useMemo } from 'react';
import type { CanvasElement } from '@orim/shared';
import type { CanvasEngine } from '../canvas/engine.js';
import { useBoardStore } from '../stores/boardStore.js';
import {
  contextActionRegistry,
  type PropertiesContext,
  type PropertyField,
} from '../canvas/actions/index.js';
import './PropertiesPanel.css';

interface PropertiesPanelProps {
  engine: CanvasEngine | null;
}

const GROUP_LABELS: Record<NonNullable<PropertyField['group']>, string> = {
  appearance: 'Aparência',
  content: 'Conteúdo',
  layout: 'Layout',
  advanced: 'Avançado',
};

export function PropertiesPanel({ engine }: PropertiesPanelProps) {
  const {
    selectedIds,
    primarySelectionId,
    getElement,
    addElement,
    updateElement,
    removeElement,
    setSelectedIds,
    getElements,
  } = useBoardStore();

  const ctx: PropertiesContext | null = useMemo(() => {
    if (!engine) return null;
    const selection = selectedIds
      .map((id) => getElement(id))
      .filter((el): el is CanvasElement => Boolean(el));
    const primary = primarySelectionId ? getElement(primarySelectionId) : selection[0] ?? null;
    return {
      selection,
      primary,
      engine,
      store: { addElement, updateElement, removeElement, setSelectedIds, getElement, getElements },
      patch: (id, patch) => updateElement(id, patch),
    };
  }, [engine, selectedIds, primarySelectionId, getElement, addElement, updateElement, removeElement, setSelectedIds, getElements]);

  const fields = useMemo(() => (ctx ? contextActionRegistry.resolveProperties(ctx) : []), [ctx]);

  if (!ctx || !ctx.primary) {
    return (
      <div className="properties-panel">
        <div className="panel-empty">Selecione um objeto para ver suas propriedades</div>
      </div>
    );
  }

  const grouped: Record<string, PropertyField[]> = {};
  for (const field of fields) {
    const g = field.group ?? 'advanced';
    grouped[g] = grouped[g] ?? [];
    grouped[g].push(field);
  }

  const order: (keyof typeof GROUP_LABELS)[] = ['content', 'appearance', 'layout', 'advanced'];

  return (
    <div className="properties-panel">
      <div className="prop-header">
        <strong>{ctx.primary.type}</strong>
        <span className="prop-count">
          {ctx.selection.length === 1 ? '1 selecionado' : `${ctx.selection.length} itens`}
        </span>
      </div>
      {order.map((group) => {
        const items = grouped[group];
        if (!items || items.length === 0) return null;
        return (
          <div className="prop-group" key={group}>
            <div className="prop-group-label">{GROUP_LABELS[group]}</div>
            {items.map((field) => (
              <PropertyRow key={field.id} ctx={ctx} field={field} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PropertyRow({ ctx, field }: { ctx: PropertiesContext; field: PropertyField }) {
  if (field.render) {
    const Comp = field.render;
    return <Comp ctx={ctx} />;
  }
  const value = field.get(ctx);
  switch (field.type) {
    case 'text':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <input
            type="text"
            value={String(value ?? '')}
            onChange={(e) => field.set(ctx, e.target.value)}
          />
        </div>
      );
    case 'textarea':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <textarea
            rows={3}
            value={String(value ?? '')}
            onChange={(e) => field.set(ctx, e.target.value)}
          />
        </div>
      );
    case 'number':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <input
            type="number"
            value={Number(value ?? 0)}
            min={field.min}
            max={field.max}
            step={field.step ?? 1}
            onChange={(e) => field.set(ctx, Number(e.target.value))}
          />
        </div>
      );
    case 'slider':
      return (
        <div className="prop-row column">
          <div className="prop-row-head">
            <label>{field.label}</label>
            <span className="prop-value-tag">{String(value)}</span>
          </div>
          <input
            type="range"
            value={Number(value ?? 0)}
            min={field.min ?? 0}
            max={field.max ?? 100}
            step={field.step ?? 1}
            onChange={(e) => field.set(ctx, Number(e.target.value))}
          />
        </div>
      );
    case 'toggle':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => field.set(ctx, e.target.checked)}
          />
        </div>
      );
    case 'select':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <select
            value={String(value ?? '')}
            onChange={(e) => field.set(ctx, e.target.value)}
          >
            {field.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      );
    case 'color':
      return (
        <div className="prop-row">
          <label>{field.label}</label>
          <input
            type="color"
            value={`#${Number(value ?? 0).toString(16).padStart(6, '0')}`}
            onChange={(e) => {
              const v = parseInt(e.target.value.slice(1), 16);
              field.set(ctx, v);
            }}
          />
        </div>
      );
    case 'tags': {
      const tags = (value as string[]) ?? [];
      return (
        <div className="prop-row column">
          <label>{field.label}</label>
          <div className="prop-tags">
            {tags.map((t, i) => (
              <span key={i} className="prop-tag">
                {t}
                <button
                  onClick={() => field.set(ctx, tags.filter((_, ix) => ix !== i))}
                >
                  ×
                </button>
              </span>
            ))}
            <input
              type="text"
              placeholder="+ tag"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const t = (e.target as HTMLInputElement).value.trim();
                  if (t) {
                    field.set(ctx, [...tags, t]);
                    (e.target as HTMLInputElement).value = '';
                  }
                }
              }}
            />
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
