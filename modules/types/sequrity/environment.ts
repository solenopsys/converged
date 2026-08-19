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

export type UserEnvironment = {
  windows: SavedWindow[];
  commands: CommandLayout;
  updatedAt: string;
};

export interface EnvironmentService {
  getCurrent(): Promise<UserEnvironment>;
  saveWindows(windows: SavedWindow[]): Promise<UserEnvironment>;
  saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment>;
}
