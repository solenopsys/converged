import { describe, expect, test } from 'bun:test';
import { createBridgeController } from './controller';

describe('bridge/controller', () => {
  test('normalizes menu and resolves action selection', async () => {
    const selected: string[] = [];
    const controller = createBridgeController({
      onMenuAction: async (actionId) => {
        selected.push(actionId);
      },
    });

    controller.setMenu([
      {
        title: 'Main',
        items: [{ title: 'Docs', action: 'docs.open' }],
      },
    ]);

    const ok = await controller.selectMenuAction('docs.open');
    const missing = await controller.selectMenuAction('not-found');

    expect(ok).toBe(true);
    expect(missing).toBe(false);
    expect(selected).toEqual(['docs.open']);
  });

  test('tracks panel commands and module loading state in snapshot', async () => {
    const controller = createBridgeController({
      modules: {
        docs: async () => ({ default: 'docs-module' }),
      },
    });

    controller.dispatchPanel({ type: 'panel.activate', panelId: 'chat' });
    await controller.loadModule('docs');

    const snap = controller.snapshot();
    expect(snap.panel.activePanelId).toBe('chat');
    expect(snap.modules.docs).toBe('ready');
  });
});
