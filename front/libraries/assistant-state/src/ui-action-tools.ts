import type { ExecutableTool } from './types';

// Minimal interfaces — injected by caller, no front-core dependency here
export interface ActionBrief {
    id: string;
    brief: string;
    category?: string;
}

export interface CategorySummary {
    id: string;
    count: number;
}

export interface UIActionRegistryLike {
    get(id: string): { id: string; brief?: string; description: string; category?: string } | undefined;
    run(id: string, params: any): void;
}

export interface ActionContextManagerLike {
    recordInvoke(id: string): void;
    getHot(): ActionBrief[];
    listCategories(): CategorySummary[];
    listByCategory(category: string): ActionBrief[];
    search(query: string, limit?: number): ActionBrief[];
}

// Called when invokeUIAction gets an unknown action id — can lazy-load an MF bundle
export type MFLoader = (actionId: string) => Promise<void>;

export function createUIActionTools(
    registry: UIActionRegistryLike,
    ctx: ActionContextManagerLike,
    loadMF?: MFLoader,
): ExecutableTool[] {
    return [
        {
            name: 'listUIActions',
            description:
                'List available UI actions. ' +
                'Without args: returns recently used (hot) actions and available categories. ' +
                'With query: fuzzy-searches all actions by id and description. ' +
                'With category: filters by category. ' +
                'Always call this first when you are unsure what action to invoke.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'Fuzzy search query across action ids and descriptions',
                    },
                    category: {
                        type: 'string',
                        description: 'Filter by category id (from listUIActions categories)',
                    },
                },
            },
            execute: ({ query, category }: { query?: string; category?: string } = {}) => {
                if (query) return ctx.search(query);
                if (category) return ctx.listByCategory(category);
                return { hot: ctx.getHot(), categories: ctx.listCategories() };
            },
        },

        {
            name: 'describeUIAction',
            description:
                'Get the full description of a specific UI action before invoking it. ' +
                'Use when you need to confirm parameters before calling invokeUIAction.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The action id' },
                },
                required: ['id'],
            },
            execute: ({ id }: { id: string }) => {
                const action = registry.get(id);
                if (!action) {
                    return {
                        error: `Action not found: "${id}". Use listUIActions to discover available actions.`,
                    };
                }
                return {
                    id: action.id,
                    brief: action.brief,
                    description: action.description,
                    category: action.category,
                };
            },
        },

        {
            name: 'invokeUIAction',
            description:
                'Execute a UI action by id — navigation, showing views, mounting widgets. ' +
                'Only for visual changes visible to the user. ' +
                'Do NOT use for backend workflows or data mutations — those belong to ms-agent.',
            parameters: {
                type: 'object',
                properties: {
                    id: { type: 'string', description: 'The action id to invoke' },
                    args: { type: 'object', description: 'Optional arguments for the action' },
                },
                required: ['id'],
            },
            execute: async ({ id, args = {} }: { id: string; args?: Record<string, any> }) => {
                if (!registry.get(id) && loadMF) {
                    await loadMF(id);
                }
                const action = registry.get(id);
                if (!action) {
                    return {
                        error: `Action not found: "${id}". Use listUIActions to find the correct action id.`,
                    };
                }
                ctx.recordInvoke(id);
                registry.run(id, args);
                return { ok: true, actionId: id };
            },
        },
    ];
}
