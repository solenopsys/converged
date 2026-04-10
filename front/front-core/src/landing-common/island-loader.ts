import { prepareModulesFilterBootstrap } from '../bridge/modules-filter';

type IslandModule = {
  mount: (
    container: HTMLElement,
    props: Record<string, unknown>,
  ) => void | Promise<void>;
};

type IslandLoader = () => Promise<IslandModule>;

const registry: Record<string, IslandLoader> = {};

export function registerIsland(name: string, loader: IslandLoader): void {
  registry[name] = loader;
}

function parseProps(el: HTMLElement): Record<string, unknown> {
  const raw = el.dataset.islandProps;
  if (!raw) return {};

  try {
    return JSON.parse(raw);
  } catch {
    console.warn(
      `[islands] Invalid JSON in data-island-props for "${el.dataset.island}"`,
    );
    return {};
  }
}

async function mountIsland(el: HTMLElement): Promise<void> {
  const name = el.dataset.island;
  if (!name) return;

  if (el.dataset.islandMounted === 'true') return;
  el.dataset.islandMounted = 'true';

  const loader = registry[name];
  if (!loader) {
    console.warn(`[islands] No loader registered for island "${name}"`);
    return;
  }

  try {
    const mod = await loader();
    const props = parseProps(el);
    await mod.mount(el, props);
  } catch (err) {
    console.error(`[islands] Failed to mount island "${name}"`, err);
    el.dataset.islandMounted = 'error';
  }
}

function mountWhenVisible(el: HTMLElement): void {
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          observer.unobserve(el);
          void mountIsland(el);
        }
      }
    },
    { rootMargin: '200px' },
  );
  observer.observe(el);
}

function mountOnIdle(el: HTMLElement): void {
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      void mountIsland(el);
    });
  } else {
    setTimeout(() => {
      void mountIsland(el);
    }, 1);
  }
}

async function processIslands(): Promise<void> {
  await prepareModulesFilterBootstrap();

  const islands = document.querySelectorAll<HTMLElement>('[data-island]');

  for (const el of islands) {
    if (el.dataset.islandMounted === 'true') continue;

    const loadStrategy = el.dataset.islandLoad ?? 'idle';

    switch (loadStrategy) {
      case 'visible':
        mountWhenVisible(el);
        break;
      case 'eager':
        void mountIsland(el);
        break;
      case 'idle':
      default:
        mountOnIdle(el);
        break;
    }
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      void processIslands();
    }, {
      once: true,
    });
  } else {
    void processIslands();
  }
}
