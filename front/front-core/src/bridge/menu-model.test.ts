import { describe, expect, test } from 'bun:test';
import {
  collectMenuActionIds,
  findMenuItemByActionId,
  normalizeMenuSections,
  toActionId,
} from './menu-model';

describe('bridge/menu-model', () => {
  test('extracts action ids from string and object action', () => {
    expect(toActionId('page.open')).toBe('page.open');
    expect(toActionId({ id: 'docs.open' })).toBe('docs.open');
    expect(toActionId({ id: '' })).toBeNull();
    expect(toActionId(null)).toBeNull();
  });

  test('normalizes grouped menu and keeps nested items', () => {
    const sections = normalizeMenuSections([
      {
        title: 'Content',
        items: [
          {
            title: 'Landing',
            action: 'landing.show.default',
          },
          {
            title: 'Docs',
            items: [
              {
                title: 'Home',
                action: { id: 'docs.show.home' },
              },
            ],
          },
          {
            title: 'Noop',
          },
        ],
      },
    ]);

    expect(sections.length).toBe(1);
    expect(sections[0].items.length).toBe(2);
    expect(sections[0].items[1].items.length).toBe(1);
    expect(sections[0].items[1].items[0].actionId).toBe('docs.show.home');
  });

  test('collects unique action ids and finds menu item by action id', () => {
    const sections = normalizeMenuSections([
      {
        title: 'AI',
        items: [
          { title: 'Assistants', action: 'assistants.open' },
          {
            title: 'Agents',
            items: [{ title: 'List', action: 'agents.list' }],
          },
        ],
      },
    ]);

    expect(collectMenuActionIds(sections)).toEqual([
      'assistants.open',
      'agents.list',
    ]);

    const found = findMenuItemByActionId(sections, 'agents.list');
    expect(found?.title).toBe('List');
    expect(findMenuItemByActionId(sections, 'unknown')).toBeNull();
  });
});
