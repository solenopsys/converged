import { createDomain } from "effector";
import { createDomainLogger } from "../../../libraries/effector/effector-logger/logger";
import type {
	CategoryId,
	MicrofrontendDefinition,
	MicrofrontendManifest,
	ObjectIndexFile,
	ObjectTypeDefinition,
	OperationDefinition,
	ViewDefinition,
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
	private readonly types = new Map<string, Owned<ObjectTypeDefinition>>();
	private readonly views = new Map<string, Owned<ViewDefinition>>();
	private readonly operations = new Map<string, Owned<OperationDefinition>>();
	private readonly moduleDescriptions = new Map<string, string>();
	private readonly cleanups = new Map<string, () => void>();

	declare(owner: string, manifest: MicrofrontendManifest): void {
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
			const explicit = entry.llm?.description?.trim();
			const actionDescriptions = [
				...new Set(
					Object.values(entry.llm?.actions ?? {}).flatMap((action) => {
						const description =
							action.description?.trim() || action.brief?.trim();
						return description ? [description] : [];
					}),
				),
			];
			const description = explicit || actionDescriptions.join("; ");
			if (description) this.moduleDescriptions.set(entry.module, description);
			this.declare(entry.module, entry.manifest);
		}
	}

	moduleDescription(id: string): string | undefined {
		return this.moduleDescriptions.get(id);
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

	hasCategory(typeId: string, categoryId: CategoryId): boolean {
		return this.types.get(typeId)?.categories?.includes(categoryId) ?? false;
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
