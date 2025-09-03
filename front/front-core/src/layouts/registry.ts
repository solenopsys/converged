// component-registry.ts
export type SlotName = "left" | "center" | "right" | "bottom";
export type CapId = string; // "node.editor", "workflow.inspect", ...

type Loader<P = any> = () => Promise<{ default: React.FC<P> }>;

class ComponentRegistry {
  private map = new Map<string, Loader>();

  // ключ = `${slot}:${capId}`
  register<P>(slot: SlotName, cap: CapId, loader: Loader<P>) {
    this.map.set(`${slot}:${cap}`, loader as Loader);
  }

  get(slot: SlotName, cap: CapId): Loader | undefined {
    return this.map.get(`${slot}:${cap}`);
  }
}

export const registry = new ComponentRegistry();
