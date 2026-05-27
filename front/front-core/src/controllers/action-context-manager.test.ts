import { describe, expect, test, beforeEach } from 'bun:test';
import { ActionContextManager } from './action-context-manager';

const makeRegistry = (actions: Array<{ id: string; brief?: string; description: string; category?: string }>) => ({
    getAll: () => actions,
});

describe('ActionContextManager', () => {
    describe('hot context (LRU)', () => {
        test('recordInvoke adds to hot list', () => {
            const reg = makeRegistry([
                { id: 'a.show', brief: 'Open A', description: 'Show A' },
                { id: 'b.show', brief: 'Open B', description: 'Show B' },
            ]);
            const mgr = new ActionContextManager(reg);
            mgr.recordInvoke('a.show');
            mgr.recordInvoke('b.show');
            const hot = mgr.getHot();
            expect(hot[0].id).toBe('b.show');
            expect(hot[1].id).toBe('a.show');
        });

        test('deduplaces and moves to front on re-invoke', () => {
            const reg = makeRegistry([
                { id: 'a.show', brief: 'Open A', description: 'Show A' },
                { id: 'b.show', brief: 'Open B', description: 'Show B' },
            ]);
            const mgr = new ActionContextManager(reg);
            mgr.recordInvoke('a.show');
            mgr.recordInvoke('b.show');
            mgr.recordInvoke('a.show');
            const hot = mgr.getHot();
            expect(hot.length).toBe(2);
            expect(hot[0].id).toBe('a.show');
        });

        test('caps at maxHot=10', () => {
            const actions = Array.from({ length: 15 }, (_, i) => ({
                id: `action.${i}`,
                brief: `Action ${i}`,
                description: `Action ${i}`,
            }));
            const mgr = new ActionContextManager(makeRegistry(actions));
            for (const a of actions) mgr.recordInvoke(a.id);
            expect(mgr.getHot().length).toBe(10);
        });

        test('falls back to description when brief is absent', () => {
            const reg = makeRegistry([
                { id: 'x.show', description: 'A very long description that will be truncated here.' },
            ]);
            const mgr = new ActionContextManager(reg);
            mgr.recordInvoke('x.show');
            const [entry] = mgr.getHot();
            expect(entry.brief.length).toBeLessThanOrEqual(80);
        });
    });

    describe('listCategories', () => {
        test('groups actions by category and counts them', () => {
            const reg = makeRegistry([
                { id: 'a', description: 'A', category: 'sales' },
                { id: 'b', description: 'B', category: 'sales' },
                { id: 'c', description: 'C', category: 'analytics' },
                { id: 'd', description: 'D' },
            ]);
            const mgr = new ActionContextManager(reg);
            const cats = mgr.listCategories();
            const sales = cats.find(c => c.id === 'sales');
            const analytics = cats.find(c => c.id === 'analytics');
            const other = cats.find(c => c.id === 'other');
            expect(sales?.count).toBe(2);
            expect(analytics?.count).toBe(1);
            expect(other?.count).toBe(1);
        });
    });

    describe('listByCategory', () => {
        test('returns only actions of the given category', () => {
            const reg = makeRegistry([
                { id: 'a', brief: 'A', description: 'A', category: 'sales' },
                { id: 'b', brief: 'B', description: 'B', category: 'analytics' },
                { id: 'c', brief: 'C', description: 'C', category: 'sales' },
            ]);
            const mgr = new ActionContextManager(reg);
            const result = mgr.listByCategory('sales');
            expect(result.map(r => r.id)).toEqual(['a', 'c']);
        });

        test('returns empty array for unknown category', () => {
            const reg = makeRegistry([{ id: 'a', description: 'A', category: 'sales' }]);
            const mgr = new ActionContextManager(reg);
            expect(mgr.listByCategory('nonexistent')).toEqual([]);
        });
    });

    describe('search', () => {
        test('matches by id word', () => {
            const reg = makeRegistry([
                { id: 'leads.show', brief: 'Open leads', description: 'Show leads list' },
                { id: 'contacts.show', brief: 'Open contacts', description: 'Show contacts list' },
                { id: 'geo.list.show', brief: 'Open geo', description: 'Show geo list' },
            ]);
            const mgr = new ActionContextManager(reg);
            const result = mgr.search('leads');
            expect(result.length).toBe(1);
            expect(result[0].id).toBe('leads.show');
        });

        test('matches by brief word', () => {
            const reg = makeRegistry([
                { id: 'a.show', brief: 'Open contacts panel', description: 'Show A' },
                { id: 'b.show', brief: 'Open leads panel', description: 'Show B' },
            ]);
            const mgr = new ActionContextManager(reg);
            const result = mgr.search('contacts');
            expect(result[0].id).toBe('a.show');
        });

        test('ranks higher-word-count matches first', () => {
            const reg = makeRegistry([
                { id: 'sales.stats.show', brief: 'Open sales statistics', description: 'Show sales stats' },
                { id: 'sales.leads.show', brief: 'Open sales leads', description: 'Show sales leads list' },
            ]);
            const mgr = new ActionContextManager(reg);
            // both match "sales", but first also matches "stats"
            const result = mgr.search('sales stats');
            expect(result[0].id).toBe('sales.stats.show');
        });

        test('returns empty for no matches', () => {
            const reg = makeRegistry([
                { id: 'a.show', brief: 'Open A', description: 'Show A' },
            ]);
            const mgr = new ActionContextManager(reg);
            expect(mgr.search('zzznomatch')).toEqual([]);
        });

        test('respects limit', () => {
            const actions = Array.from({ length: 20 }, (_, i) => ({
                id: `show.item.${i}`,
                brief: `Show item ${i}`,
                description: `Show item ${i}`,
            }));
            const mgr = new ActionContextManager(makeRegistry(actions));
            expect(mgr.search('show', 5).length).toBe(5);
        });
    });
});
