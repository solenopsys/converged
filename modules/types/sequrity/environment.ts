/** Serializable description of a workspace tab. UI components are never stored. */
export type SavedWindow = {
	key: string;
	actionId: string;
	params?: Record<string, unknown>;
	pinned?: boolean;
};

/** User preference only; it cannot grant a command the user lacks permission for. */
export type CommandLayout = {
	pinned: string[];
	hidden: string[];
	order: string[];
};

/**
 * Which surfaces the user keeps in the tab strip. Both lists are overrides on
 * top of the deployment's configured pins: `unpinned` is how a user removes a
 * surface the workspace pins by default. Like the command layout it is a
 * preference only — a pinned surface the session has no rights to is not shown.
 */
export type SurfaceLayout = {
	pinned: string[];
	unpinned: string[];
};

export type UserEnvironment = {
	windows: SavedWindow[];
	commands: CommandLayout;
	surfaces: SurfaceLayout;
	updatedAt: string;
};

export interface EnvironmentService {
	getCurrent(): Promise<UserEnvironment>;
	saveWindows(windows: SavedWindow[]): Promise<UserEnvironment>;
	saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment>;
	saveSurfaceLayout(layout: SurfaceLayout): Promise<UserEnvironment>;
}
