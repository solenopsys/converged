export type ActionLike = string | { id?: string | null } | null | undefined;

export interface BridgeMenuItem {
  id: string;
  title: string;
  actionId: string | null;
  iconName?: string;
  items: BridgeMenuItem[];
}

export interface BridgeMenuSection {
  id: string;
  title: string;
  iconName?: string;
  items: BridgeMenuItem[];
}

export interface BridgePanelState {
  leftOpen: boolean;
  rightOpen: boolean;
  activePanelId: string | null;
}

export type BridgePanelCommand =
  | { type: 'reset' }
  | { type: 'left.toggle' }
  | { type: 'left.set'; open: boolean }
  | { type: 'right.toggle' }
  | { type: 'right.set'; open: boolean }
  | { type: 'panel.activate'; panelId: string }
  | { type: 'panel.deactivate' };

export type SpaModuleFactory<T = unknown> = () => Promise<T>;
export type SpaModuleRegistry = Record<string, SpaModuleFactory>;
export type SpaModuleStatus = 'idle' | 'loading' | 'ready' | 'error';
