import { describe, expect, test } from 'bun:test';
import {
  createInitialPanelState,
  defaultPanelState,
  reducePanelState,
} from './panel-state';

describe('bridge/panel-state', () => {
  test('creates initial state with defaults', () => {
    expect(createInitialPanelState()).toEqual(defaultPanelState);
  });

  test('activating panel opens right rail and sets active panel', () => {
    const initial = createInitialPanelState({ rightOpen: false });
    const next = reducePanelState(initial, {
      type: 'panel.activate',
      panelId: 'chat',
    });

    expect(next.rightOpen).toBe(true);
    expect(next.activePanelId).toBe('chat');
  });

  test('closing right rail clears active panel', () => {
    const initial = createInitialPanelState({
      rightOpen: true,
      activePanelId: 'inspector',
    });
    const next = reducePanelState(initial, {
      type: 'right.set',
      open: false,
    });

    expect(next.rightOpen).toBe(false);
    expect(next.activePanelId).toBeNull();
  });

  test('toggle left panel only affects left visibility', () => {
    const initial = createInitialPanelState({
      leftOpen: true,
      rightOpen: true,
      activePanelId: 'chat',
    });
    const next = reducePanelState(initial, { type: 'left.toggle' });

    expect(next.leftOpen).toBe(false);
    expect(next.rightOpen).toBe(true);
    expect(next.activePanelId).toBe('chat');
  });
});
