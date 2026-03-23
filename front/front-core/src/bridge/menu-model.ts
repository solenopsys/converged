import type { ActionLike, BridgeMenuItem, BridgeMenuSection } from './types';

type LooseRecord = Record<string, unknown>;

function asRecord(value: unknown): LooseRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as LooseRecord;
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toActionId(action: ActionLike): string | null {
  if (typeof action === 'string') {
    const trimmed = action.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (!action || typeof action !== 'object') return null;
  return asNonEmptyString((action as { id?: unknown }).id);
}

function normalizeMenuItem(raw: unknown, fallbackId: string): BridgeMenuItem | null {
  const rec = asRecord(raw);
  if (!rec) return null;

  const title = asNonEmptyString(rec.title) ?? asNonEmptyString(rec.key) ?? fallbackId;
  const id = (
    asNonEmptyString(rec.id) ??
    asNonEmptyString(rec.key) ??
    slugify(title)
  ) || fallbackId;
  const actionId = toActionId(rec.action as ActionLike);
  const iconName = asNonEmptyString(rec.iconName) ?? undefined;
  const rawItems = Array.isArray(rec.items) ? rec.items : [];

  const items = rawItems
    .map((item, index) => normalizeMenuItem(item, `${id}-${index + 1}`))
    .filter((item): item is BridgeMenuItem => Boolean(item));

  if (!actionId && items.length === 0) return null;

  return {
    id,
    title,
    actionId,
    iconName,
    items,
  };
}

export function normalizeMenuSections(raw: unknown): BridgeMenuSection[] {
  const list = Array.isArray(raw) ? raw : [];
  const result: BridgeMenuSection[] = [];

  for (const [index, sectionRaw] of list.entries()) {
    const rec = asRecord(sectionRaw);
    if (!rec) continue;

    const title = asNonEmptyString(rec.title) ?? `Section ${index + 1}`;
    const id = (
      asNonEmptyString(rec.id) ??
      slugify(title)
    ) || `section-${index + 1}`;
    const iconName = asNonEmptyString(rec.iconName) ?? undefined;
    const rawItems = Array.isArray(rec.items) ? rec.items : [];

    const items = rawItems
      .map((item, itemIndex) => normalizeMenuItem(item, `${id}-${itemIndex + 1}`))
      .filter((item): item is BridgeMenuItem => Boolean(item));

    if (items.length === 0) continue;

    result.push({
      id,
      title,
      iconName,
      items,
    });
  }

  return result;
}

function walk(items: BridgeMenuItem[], cb: (item: BridgeMenuItem) => void): void {
  for (const item of items) {
    cb(item);
    if (item.items.length > 0) walk(item.items, cb);
  }
}

export function collectMenuActionIds(sections: BridgeMenuSection[]): string[] {
  const ids = new Set<string>();
  for (const section of sections) {
    walk(section.items, (item) => {
      if (item.actionId) ids.add(item.actionId);
    });
  }
  return [...ids];
}

export function findMenuItemByActionId(
  sections: BridgeMenuSection[],
  actionId: string,
): BridgeMenuItem | null {
  const target = actionId.trim();
  if (!target) return null;

  for (const section of sections) {
    let found: BridgeMenuItem | null = null;
    walk(section.items, (item) => {
      if (!found && item.actionId === target) found = item;
    });
    if (found) return found;
  }

  return null;
}
