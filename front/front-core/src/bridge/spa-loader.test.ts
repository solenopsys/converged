import { describe, expect, test } from 'bun:test';
import { createSpaModuleLoader } from './spa-loader';

describe('bridge/spa-loader', () => {
  test('deduplicates concurrent loads for the same module', async () => {
    let calls = 0;
    const loader = createSpaModuleLoader({
      dashboard: async () => {
        calls += 1;
        await Bun.sleep(10);
        return { name: 'dashboard' };
      },
    });

    const [a, b] = await Promise.all([
      loader.load('dashboard'),
      loader.load('dashboard'),
    ]);

    expect(calls).toBe(1);
    expect(a).toEqual({ name: 'dashboard' });
    expect(b).toEqual({ name: 'dashboard' });
    expect(loader.getStatus('dashboard')).toBe('ready');
  });

  test('moves failed module to error and allows retry after reset', async () => {
    let shouldFail = true;
    const loader = createSpaModuleLoader({
      profile: async () => {
        if (shouldFail) {
          throw new Error('boom');
        }
        return { ok: true };
      },
    });

    await expect(loader.load('profile')).rejects.toThrow('boom');
    expect(loader.getStatus('profile')).toBe('error');

    loader.reset('profile');
    shouldFail = false;

    const value = await loader.load('profile');
    expect(value).toEqual({ ok: true });
    expect(loader.getStatus('profile')).toBe('ready');
  });

  test('preload tolerates unknown modules and does not throw', async () => {
    const loader = createSpaModuleLoader({
      known: async () => ({ ok: true }),
    });

    await expect(loader.preload(['known', 'missing'])).resolves.toBeUndefined();
    expect(loader.getStatus('known')).toBe('ready');
    expect(loader.getStatus('missing')).toBe('idle');
  });
});
