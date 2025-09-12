// scene-model.ts
import { createStore, createEvent, sample } from "effector";

export interface SceneSlot { cap: string | null; params?: any }
export interface Scene { left: SceneSlot; center: SceneSlot; right: SceneSlot; bottom: SceneSlot }

export const $scene = createStore<Scene>({
  left:   { cap: "menu" },
  center: { cap: "welcome" },
  right:  { cap: null },
  bottom: { cap: null },
});

export const openNode = createEvent<{ workflowId: string; nodeId: string }>();

sample({
  clock: openNode,
  source: $scene,
  fn: (scene, { workflowId, nodeId }): Scene => ({
    ...scene,
    center: { cap: "node.editor", params: { nodeId } },
    right:  { cap: "workflow.inspect", params: { workflowId } },
  }),
  target: $scene,
});
