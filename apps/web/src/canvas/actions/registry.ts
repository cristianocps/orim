import type {
  ContextAction,
  ContextActionContext,
  ContextActionProvider,
  PropertiesContext,
  PropertyField,
  ResolvedActions,
  ActionSurface,
} from './types.js';

class ContextActionRegistry {
  private providers: ContextActionProvider[] = [];

  register(provider: ContextActionProvider) {
    this.providers = this.providers.filter((p) => p.id !== provider.id);
    this.providers.push(provider);
  }

  unregister(id: string) {
    this.providers = this.providers.filter((p) => p.id !== id);
  }

  list(): ContextActionProvider[] {
    return [...this.providers];
  }

  resolveActions(ctx: ContextActionContext, surface: ActionSurface = 'toolbar'): ResolvedActions {
    const flat: ContextAction[] = [];
    const seen = new Set<string>();
    const types = ctx.selection.length === 0 ? null : new Set<string>(ctx.selection.map((el) => el.type as string));
    for (const provider of this.providers) {
      if (provider.types.length > 0) {
        if (!types) continue;
        const matches = provider.types.some((t) => types.has(t));
        if (!matches) continue;
      }
      const actions = provider.actions?.(ctx) ?? [];
      for (const action of actions) {
        if (action.surfaces && !action.surfaces.includes(surface)) continue;
        if (action.isAvailable && !action.isAvailable(ctx)) continue;
        if (seen.has(action.id)) continue;
        seen.add(action.id);
        flat.push(action);
      }
    }
    const byGroup = new Map<ResolvedActions['byGroup'] extends Map<infer K, any> ? K : never, ContextAction[]>();
    for (const action of flat) {
      const list = byGroup.get(action.group) ?? [];
      list.push(action);
      byGroup.set(action.group, list);
    }
    return { byGroup, flat };
  }

  resolveProperties(ctx: PropertiesContext): PropertyField[] {
    const fields: PropertyField[] = [];
    const seen = new Set<string>();
    const types = ctx.selection.length === 0 ? null : new Set<string>(ctx.selection.map((el) => el.type as string));
    for (const provider of this.providers) {
      if (provider.types.length > 0) {
        if (!types) continue;
        if (!provider.types.some((t) => types.has(t))) continue;
      }
      const next = provider.properties?.(ctx) ?? [];
      for (const field of next) {
        if (field.isAvailable && !field.isAvailable(ctx)) continue;
        if (seen.has(field.id)) continue;
        seen.add(field.id);
        fields.push(field);
      }
    }
    return fields;
  }

  resolveExtras(ctx: PropertiesContext) {
    const extras: ContextActionProvider[] = [];
    const types = ctx.selection.length === 0 ? null : new Set<string>(ctx.selection.map((el) => el.type as string));
    for (const provider of this.providers) {
      if (provider.types.length > 0) {
        if (!types) continue;
        if (!provider.types.some((t) => types.has(t))) continue;
      }
      if (provider.renderExtras) extras.push(provider);
    }
    return extras;
  }
}

export const contextActionRegistry = new ContextActionRegistry();
