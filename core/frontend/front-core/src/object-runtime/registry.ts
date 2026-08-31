import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import {
	type CategoryDefinition,
	CORE_CATEGORIES,
	type MicrofrontendDefinition,
	type MicrofrontendManifest,
	type ObjectIndexFile,
	type ObjectTypeDefinition,
	type OperationDefinition,
	type ViewDefinition,
} from "./types";

type Owned<T> = T & { owner: string; loaded: boolean };

const domain = createDomain("object-runtime-registry");
createDomainLogger(domain);

export const microfrontendDeclared = domain.createEvent<MicrofrontendManifest>(
	"MICROFRONTEND_DECLARED",
);
export const microfrontendRegistered =
	domain.createEvent<MicrofrontendDefinition>("MICROFRONTEND_REGISTERED");
export const $objectRegistryRevision = domain
	.createStore(0, { name: "OBJECT_REGISTRY_REVISION" })
	.on(microfrontendDeclared, (revision) => revision + 1)
	.on(microfrontendRegistered, (revision) => revision + 1);

export class ObjectRegistry {
	private readonly categories = new Map<string, Owned<CategoryDefinition>>();
	private readonly types = new Map<string, Owned<ObjectTypeDefinition>>();
	private readonly views = new Map<string, Owned<ViewDefinition>>();
	private readonly operations = new Map<string, Owned<OperationDefinition>>();
	private readonly cleanups = new Map<string, () => void>();

	constructor() {
		for (const category of CORE_CATEGORIES) {
			this.categories.set(category.id, {
				...category,
				owner: "front-core",
				loaded: true,
			});
		}
	}

	declare(owner: string, manifest: MicrofrontendManifest): void {
		for (const category of manifest.categories ?? []) {
			this.categories.set(category.id, { ...category, owner, loaded: false });
		}
		for (const type of manifest.types) {
			this.types.set(type.id, { ...type, owner, loaded: false });
		}
		for (const view of manifest.views) {
			this.views.set(view.id, { ...view, owner, loaded: false });
		}
		for (const operation of manifest.operations) {
			this.operations.set(operation.id, {
				...operation,
				owner,
				loaded: false,
			});
		}
		microfrontendDeclared(manifest);
	}

	register(owner: string, definition: MicrofrontendDefinition): void {
		this.cleanups.get(definition.id)?.();
		for (const category of definition.categories ?? []) {
			this.categories.set(category.id, { ...category, owner, loaded: true });
		}
		for (const type of definition.types) {
			this.types.set(type.id, { ...type, owner, loaded: true });
		}
		for (const view of definition.views) {
			this.views.set(view.id, { ...view, owner, loaded: true });
		}
		for (const operation of definition.operations) {
			this.operations.set(operation.id, { ...operation, owner, loaded: true });
		}
		const cleanup = definition.setup?.();
		if (cleanup) this.cleanups.set(definition.id, cleanup);
		microfrontendRegistered(definition);
	}

	ingest(index: ObjectIndexFile): void {
		for (const entry of Object.values(index.modules)) {
			this.declare(entry.module, entry.manifest);
		}
	}

	type(id: string): Owned<ObjectTypeDefinition> | undefined {
		return this.types.get(id);
	}

	view(id: string): Owned<ViewDefinition> | undefined {
		return this.views.get(id);
	}

	operation(id: string): Owned<OperationDefinition> | undefined {
		return this.operations.get(id);
	}

	allTypes(): Owned<ObjectTypeDefinition>[] {
		return [...this.types.values()];
	}

	allViews(): Owned<ViewDefinition>[] {
		return [...this.views.values()];
	}

	allOperations(): Owned<OperationDefinition>[] {
		return [...this.operations.values()];
	}

	ownerForType(id: string): string | undefined {
		return this.types.get(id)?.owner;
	}

	ownerForView(id: string): string | undefined {
		return this.views.get(id)?.owner;
	}

	ownerForOperation(id: string): string | undefined {
		return this.operations.get(id)?.owner;
	}

	hasCategory(typeId: string, categoryId: string): boolean {
		const type = this.types.get(typeId);
		if (!type) return false;
		return type.categories.some((id) => this.categoryIs(id, categoryId));
	}

	private categoryIs(candidate: string, expected: string): boolean {
		let current: string | undefined = candidate;
		const visited = new Set<string>();
		while (current && !visited.has(current)) {
			if (current === expected) return true;
			visited.add(current);
			current = this.categories.get(current)?.parent;
		}
		return false;
	}
}

export const objectRegistry = new ObjectRegistry();

export function ingestObjectIndex(index: ObjectIndexFile): void {
	objectRegistry.ingest(index);
}

export async function loadObjectIndex(url = "/mf/index.json"): Promise<void> {
	const response = await fetch(url);
	if (!response.ok)
		throw new Error(
			`[object-runtime] Index unavailable: HTTP ${response.status}`,
		);
	ingestObjectIndex((await response.json()) as ObjectIndexFile);
}
	category(id: string): Owned<CategoryDefinition> | undefined {
		return this.categories.get(id);
	}

	allCategories(): Owned<CategoryDefinition>[] {
		return [...this.categories.values()];
	}
