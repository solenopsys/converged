/**
 * Island registry for Storybook.
 * Mirrors what island-client.ts does in production — maps island names to
 * their lazy loader functions. Add new islands here as they are created.
 */

type IslandModule = {
  mount: (container: HTMLElement, props: Record<string, unknown>) => void | Promise<void>;
};

type IslandLoader = () => Promise<IslandModule>;

export const islandRegistry: Record<string, IslandLoader> = {
  "section-rail": () =>
    import("../../../../front/landing/src/islands/section-rail") as Promise<IslandModule>,
  "sales-island": () =>
    import("../../../../front/landing/src/islands/sales-island") as Promise<IslandModule>,
};
