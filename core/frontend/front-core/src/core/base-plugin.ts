import type { ActionRegistry, CreateAction, Plugin } from "./types";


export class BasePlugin implements Plugin {
	private bus: ActionRegistry | null = null;

	constructor(
		public readonly name: string,
		private readonly actions: CreateAction<any>[],
	) {}

	plug(bus: ActionRegistry): void {
		this.bus = bus;
		for (const create of this.actions) bus.register(create(bus));
	}

	unplug(): void {
		this.bus = null;
	}
}
