import type { BridgePanelCommand, BridgePanelState } from './types';

export const defaultPanelState: BridgePanelState = {
  leftOpen: true,
  rightOpen: false,
  activePanelId: null,
};

export function createInitialPanelState(
  overrides: Partial<BridgePanelState> = {},
): BridgePanelState {
  return {
    ...defaultPanelState,
    ...overrides,
    activePanelId:
      overrides.rightOpen === false
        ? null
        : overrides.activePanelId ?? defaultPanelState.activePanelId,
  };
}

export function reducePanelState(
  state: BridgePanelState,
  command: BridgePanelCommand,
): BridgePanelState {
  switch (command.type) {
    case 'reset':
      return defaultPanelState;

    case 'left.toggle':
      return { ...state, leftOpen: !state.leftOpen };

    case 'left.set':
      return { ...state, leftOpen: command.open };

    case 'right.toggle': {
      const nextRightOpen = !state.rightOpen;
      return {
        ...state,
        rightOpen: nextRightOpen,
        activePanelId: nextRightOpen ? state.activePanelId : null,
      };
    }

    case 'right.set':
      return {
        ...state,
        rightOpen: command.open,
        activePanelId: command.open ? state.activePanelId : null,
      };

    case 'panel.activate':
      return {
        ...state,
        rightOpen: true,
        activePanelId: command.panelId,
      };

    case 'panel.deactivate':
      return {
        ...state,
        activePanelId: null,
      };

    default:
      return state;
  }
}
