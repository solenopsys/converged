import {
  findMenuItemByActionId,
  normalizeMenuSections,
} from './menu-model';
import {
  createInitialPanelState,
  reducePanelState,
} from './panel-state';
import { createSpaModuleLoader } from './spa-loader';
import type {
  BridgeMenuItem,
  BridgeMenuSection,
  BridgePanelCommand,
  BridgePanelState,
  SpaModuleRegistry,
  SpaModuleStatus,
} from './types';

export interface BridgeControllerOptions {
  modules?: SpaModuleRegistry;
  onMenuAction?: (actionId: string, item: BridgeMenuItem) => void | Promise<void>;
}

export interface BridgeSnapshot {
  menu: BridgeMenuSection[];
  panel: BridgePanelState;
  modules: Record<string, SpaModuleStatus>;
}

export function createBridgeController(options: BridgeControllerOptions = {}) {
  let menu: BridgeMenuSection[] = [];
  let panel = createInitialPanelState();

  const loader = createSpaModuleLoader(options.modules);

  function setMenu(raw: unknown): BridgeMenuSection[] {
    menu = normalizeMenuSections(raw);
    return menu;
  }

  function getMenu(): BridgeMenuSection[] {
    return menu;
  }

  function dispatchPanel(command: BridgePanelCommand): BridgePanelState {
    panel = reducePanelState(panel, command);
    return panel;
  }

  function getPanel(): BridgePanelState {
    return panel;
  }

  async function selectMenuAction(actionId: string): Promise<boolean> {
    const item = findMenuItemByActionId(menu, actionId);
    if (!item) return false;

    await options.onMenuAction?.(actionId, item);
    return true;
  }

  function snapshot(): BridgeSnapshot {
    return {
      menu,
      panel,
      modules: loader.snapshot(),
    };
  }

  return {
    setMenu,
    getMenu,
    dispatchPanel,
    getPanel,
    selectMenuAction,
    loadModule: loader.load,
    preloadModules: loader.preload,
    getModuleStatus: loader.getStatus,
    resetModules: loader.reset,
    snapshot,
  };
}
