import type { Store } from "effector";
import type { ComponentType } from "preact";




export type Surface = "center" | "modal" | "full" | "chat.inline";


export type ActionMeta = {
	id: string;
	/** Public actions are the exception. Every other action requires an account session. */
	access?: "public";
	/** NRPC capability required before this action may change UI state. */
	capability?: string;

	brief?: string;

	category?: string;
	description: string;
};

export type Widget<V = Record<string, unknown>> = {
	view: ComponentType<V>;
	placement?: (params?: Record<string, unknown>) => Surface | string | string[];
	config?: Record<string, unknown>;
	commands?: Record<string, (payload: unknown) => void>;
};

export type PresentTab = {

	key?: string;
	title?: string;
	pinned?: boolean;
};

export type PresentRequest = {
	widget: Widget<any>;
	params?: Record<string, unknown>;

	tab?: PresentTab;
};

export type Action<I = any> = ActionMeta & {

	invoke: (params: I) => unknown | Promise<unknown>;
};

export type CreateAction<I = any> = (bus: ActionRegistry) => Action<I>;

export type CreateWidget<V = any> = (bus: ActionRegistry) => Widget<V>;

export interface ActionRegistry {
	register(action: Action<any>): string;

	declare(meta: ActionMeta): void;
	run(actionId: string, params?: any): unknown;

	present(request: PresentRequest): void;

	get(actionId: string): Action<any> | undefined;

	meta(actionId: string): ActionMeta | undefined;
	getAll(): ActionMeta[];
}

export interface Plugin {
	name: string;
	plug(bus: ActionRegistry): void;
	unplug(): void;
}


export type ScreenDecl<T = any> = {

	id: string;

	when: Store<T>;

	is: T | ((value: T) => boolean);
	view: ComponentType<any>;

	surface?: Surface;

	stacks?: boolean;

	title?: string | ((value: T) => string);

	props?: (value: T) => Record<string, unknown>;
};


export function defineScreens(screens: ScreenDecl<any>[]): ScreenDecl<any>[] {
	return screens;
}
