import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import { authorizeAction } from "./action-authorization";
import type {
	Action,
	ActionMeta,
	ActionRegistry,
	PresentRequest,
} from "./types";

class Registry implements ActionRegistry {
	private readonly actions = new Map<string, Action<any>>();
	private readonly declared = new Map<string, ActionMeta>();
	private readonly patterns: Array<{ prefix: string; meta: Omit<ActionMeta, "id"> }> = [];
	private activeActionId: string | undefined;

	register(action: Action<any>): string {
		const declared = this.declared.get(action.id) ?? this.pattern(action.id);
		const registered = { ...declared, ...action } as Action<any>;
		this.actions.set(registered.id, registered);
		actionRegistered(registered);
		return registered.id;
	}

	declare(meta: ActionMeta): void {
		this.declared.set(meta.id, meta);
		const action = this.actions.get(meta.id);
		if (action) {
			const registered = { ...meta, ...action } as Action<any>;
			this.actions.set(meta.id, registered);
			actionRegistered(registered);
		}
		actionDeclared(meta);
	}

	declarePattern(prefix: string, meta: Omit<ActionMeta, "id">): void {
		this.patterns.push({ prefix, meta });
	}

	private pattern(actionId: string): ActionMeta | undefined {
		const match = this.patterns
			.filter((pattern) => actionId.startsWith(pattern.prefix))
			.sort((left, right) => right.prefix.length - left.prefix.length)[0];
		return match ? { id: actionId, ...match.meta } : undefined;
	}

	run(actionId: string, params?: any): unknown {
		const action = this.actions.get(actionId);
		if (!action)
			throw new Error(`[front-core] Action not registered: ${actionId}`);

		const invoke = (): unknown => {
			const previousActionId = this.activeActionId;
			this.activeActionId = actionId;
			try {
				const result = action.invoke(params);
				if (
					result &&
					typeof (result as Promise<unknown>).finally === "function"
				) {
					return (result as Promise<unknown>).then(
						(value) => {
							actionRunSucceeded({ actionId, result: value });
							this.activeActionId = previousActionId;
							return value;
						},
						(error) => {
							actionRunFailed({ actionId, error });
							this.activeActionId = previousActionId;
							throw error;
						},
					);
				}
				actionRunSucceeded({ actionId, result });
				this.activeActionId = previousActionId;
				return result;
			} catch (error) {
				actionRunFailed({ actionId, error });
				this.activeActionId = previousActionId;
				throw error;
			}
		};

		actionRunStarted({ actionId, params });
		if (action.access === "public") return invoke();
		return authorizeAction(action).then(invoke, (error) => {
			actionRunFailed({ actionId, error });
			throw error;
		});
	}

	present(request: PresentRequest): void {
		widgetPresented({ ...request, actionId: this.activeActionId });
	}

	get(actionId: string): Action<any> | undefined {
		return this.actions.get(actionId);
	}

	meta(actionId: string): ActionMeta | undefined {
		return this.actions.get(actionId) ?? this.declared.get(actionId);
	}

	getAll(): ActionMeta[] {
		const all = new Map<string, ActionMeta>(this.declared);
		for (const [id, action] of this.actions) all.set(id, action);
		return Array.from(all.values());
	}
}

const domain = createDomain("front-core");
createDomainLogger(domain);

export const actionRegistered =
	domain.createEvent<Action<any>>("ACTION_REGISTERED");
export const actionDeclared = domain.createEvent<ActionMeta>("ACTION_DECLARED");
export const actionRunStarted = domain.createEvent<{
	actionId: string;
	params: unknown;
}>("ACTION_RUN_STARTED");
export const actionRunSucceeded = domain.createEvent<{
	actionId: string;
	result: unknown;
}>("ACTION_RUN_SUCCEEDED");
export const actionRunFailed = domain.createEvent<{
	actionId: string;
	error: unknown;
}>("ACTION_RUN_FAILED");
export const widgetPresented = domain.createEvent<
	PresentRequest & { actionId?: string }
>("WIDGET_PRESENTED");

export const $registeredCommands = domain
	.createStore<Action<any>[]>([], { name: "REGISTERED_COMMANDS" })
	.on(actionRegistered, (commands, action) =>
		commands.some((command) => command.id === action.id)
			? commands
			: [...commands, action],
	);

function mergeCatalogEntry(
	catalog: ActionMeta[],
	entry: ActionMeta,
): ActionMeta[] {
	const next = [...catalog.filter((item) => item.id !== entry.id), entry];
	return next.sort((left, right) => {
		const category = (left.category ?? "").localeCompare(right.category ?? "");
		return category === 0 ? left.id.localeCompare(right.id) : category;
	});
}

/** Full action index, including lazy actions declared by the MF catalog. */
export const $actionCatalog = domain
	.createStore<ActionMeta[]>([], { name: "ACTION_CATALOG" })
	.on(actionDeclared, mergeCatalogEntry)
	.on(actionRegistered, mergeCatalogEntry);

export const registry = new Registry();

export const bus: ActionRegistry = registry;
