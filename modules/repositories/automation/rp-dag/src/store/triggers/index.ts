import {
	BaseKeyJson,
	BaseRepositoryJson,
	generateULID,
	type JsonStore,
} from "back-core";
import type {
	WorkflowTrigger,
	WorkflowTriggerInput,
	WorkflowTriggerUpdate,
} from "g-dag";

class TriggerKey extends BaseKeyJson {
	readonly type = "trigger";
}

class TriggersRepository extends BaseRepositoryJson<TriggerKey, WorkflowTrigger> {}

/**
 * Workflow triggers: "when this topic appears on the bus, run that workflow".
 *
 * There are tens of these, not millions — they are system configuration, one
 * row per automation an operator set up. That is why they live in a JSON store
 * and why Centimanus is free to hold the whole set in memory: matching an
 * arriving event against them is a loop, not a query.
 */
export class TriggersStoreService {
	private readonly repo: TriggersRepository;

	constructor(store: JsonStore) {
		this.repo = new TriggersRepository(store);
	}

	async create(input: WorkflowTriggerInput): Promise<WorkflowTrigger> {
		const now = new Date().toISOString();
		const trigger: WorkflowTrigger = {
			id: generateULID(),
			name: input.name,
			topic: input.topic,
			script: input.script,
			params: input.params,
			enabled: input.enabled ?? true,
			createdAt: now,
			updatedAt: now,
		};
		await this.repo.save(new TriggerKey(trigger.id), trigger);
		return trigger;
	}

	async update(
		id: string,
		updates: WorkflowTriggerUpdate,
	): Promise<WorkflowTrigger | null> {
		const existing = await this.get(id);
		if (!existing) return null;
		const updated: WorkflowTrigger = {
			...existing,
			...updates,
			updatedAt: new Date().toISOString(),
		};
		await this.repo.save(new TriggerKey(id), updated);
		return updated;
	}

	async delete(id: string): Promise<boolean> {
		const existing = await this.get(id);
		if (!existing) return false;
		return this.repo.delete(new TriggerKey(id));
	}

	async get(id: string): Promise<WorkflowTrigger | null> {
		return (await this.repo.get(new TriggerKey(id))) ?? null;
	}

	async listAll(): Promise<WorkflowTrigger[]> {
		return this.repo.listAll();
	}
}
