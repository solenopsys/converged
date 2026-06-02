import { createEventsServiceClient } from "g-events";
import type {
	FileChunk,
	FileCollection,
	FileMetadata,
	FilesService,
	HashString,
	PaginatedResult,
	PaginationParams,
	UUID,
} from "g-files";
import { StoresController } from "./stores";

const MS_ID = "files-ms";

async function publishBusinessEvent(
	type: string,
	entityId: string,
): Promise<void> {
	const baseUrl = process.env.SERVICES_BASE;
	if (!baseUrl) return;

	try {
		await createEventsServiceClient({ baseUrl }).publish({
			type,
			service: "files",
			entityId,
		});
	} catch (error) {
		console.warn("[ms-files] Failed to publish business event", error);
	}
}

export class FilesServiceImpl implements FilesService {
	stores: StoresController;

	constructor() {
		this.init();
	}

	async init() {
		this.stores = new StoresController(MS_ID);
		await this.stores.init();
	}

	async save(file: FileMetadata): Promise<UUID> {
		const id = await this.stores.metadataService.save(file);
		void publishBusinessEvent("file.created", id);
		return id;
	}
	saveChunk(chunk: FileChunk): Promise<HashString> {
		return this.stores.metadataService.saveChunk(chunk);
	}
	update(id: UUID, file: FileMetadata): Promise<void> {
		return this.stores.metadataService.update(id, file);
	}
	delete(id: UUID): Promise<void> {
		return this.stores.metadataService.delete(id);
	}
	get(id: UUID): Promise<FileMetadata> {
		return this.stores.metadataService.get(id);
	}
	getChunks(id: UUID): Promise<FileChunk[]> {
		return this.stores.metadataService.getChunks(id);
	}
	list(params: PaginationParams): Promise<PaginatedResult<FileMetadata>> {
		return this.stores.metadataService.list(params);
	}
	statistic(): Promise<unknown> {
		return this.stores.metadataService.statistic();
	}
	saveCollection(collection: FileCollection): Promise<UUID> {
		return this.stores.metadataService.saveCollection(collection);
	}
	getCollection(id: UUID): Promise<FileCollection> {
		return this.stores.metadataService.getCollection(id);
	}
	deleteCollection(id: UUID): Promise<void> {
		return this.stores.metadataService.deleteCollection(id);
	}
	listByCollection(collectionId: UUID): Promise<FileMetadata[]> {
		return this.stores.metadataService.listByCollection(collectionId);
	}
}
