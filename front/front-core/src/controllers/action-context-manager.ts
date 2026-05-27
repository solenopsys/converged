import { registry } from './registry';

export interface ActionBrief {
    id: string;
    brief: string;
    category?: string;
}

export interface CategorySummary {
    id: string;
    count: number;
}

interface RegistryLike {
    getAll(): Array<{ id: string; brief?: string; description: string; category?: string }>;
}

export class ActionContextManager {
    private hotOrder: string[] = [];
    private readonly maxHot = 10;

    constructor(private readonly reg: RegistryLike) {}

    recordInvoke(id: string): void {
        this.hotOrder = [id, ...this.hotOrder.filter(x => x !== id)].slice(0, this.maxHot);
    }

    getHot(): ActionBrief[] {
        const all = this.reg.getAll();
        const map = new Map(all.map(a => [a.id, a]));
        return this.hotOrder
            .map(id => map.get(id))
            .filter((a): a is NonNullable<typeof a> => a !== undefined)
            .map(a => ({ id: a.id, brief: a.brief ?? a.description.slice(0, 80), category: a.category }));
    }

    listCategories(): CategorySummary[] {
        const counts = new Map<string, number>();
        for (const a of this.reg.getAll()) {
            const cat = a.category ?? 'other';
            counts.set(cat, (counts.get(cat) ?? 0) + 1);
        }
        return Array.from(counts.entries()).map(([id, count]) => ({ id, count }));
    }

    listByCategory(category: string): ActionBrief[] {
        return this.reg.getAll()
            .filter(a => (a.category ?? 'other') === category)
            .map(a => ({ id: a.id, brief: a.brief ?? a.description.slice(0, 80), category: a.category }));
    }

    // Word-intersection fuzzy search over id + brief + description
    search(query: string, limit = 15): ActionBrief[] {
        const words = query.toLowerCase().split(/\s+/).filter(Boolean);
        if (words.length === 0) return [];
        return this.reg.getAll()
            .map(a => {
                const text = `${a.id} ${a.brief ?? ''} ${a.description}`.toLowerCase();
                const score = words.filter(w => text.includes(w)).length;
                return { a, score };
            })
            .filter(({ score }) => score > 0)
            .sort((x, y) => y.score - x.score)
            .slice(0, limit)
            .map(({ a }) => ({ id: a.id, brief: a.brief ?? a.description.slice(0, 80), category: a.category }));
    }
}

export const actionContextManager = new ActionContextManager(registry);
