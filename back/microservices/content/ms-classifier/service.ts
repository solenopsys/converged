import { randomUUID } from "node:crypto";
import type {
	ClassifierService,
	ClassifierMapping,
	ClassifierMappingGroup,
	ClassifierMappingInput,
	ClassifierNode,
	ClassifierTreeNode,
	PaginatedResult,
	PaginationParams,
} from "./types";
import { StoresController } from "./store";

const MS_ID = "classifier-ms";

class ClassifierServiceImpl implements ClassifierService {
	stores!: StoresController;
	private readonly initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	private async init() {
		this.stores = new StoresController(MS_ID);
		await this.stores.init();
	}

	private async ensureInit(): Promise<void> {
		await this.initPromise;
	}

	async addNode(
		node: Omit<ClassifierNode, "id"> & { id?: string },
	): Promise<string> {
		await this.ensureInit();
		const id = node.id || randomUUID();
		await this.stores.sqlStoreService.addNode({
			id,
			parentId: node.parentId ?? null,
			name: node.name,
			slug: node.slug,
		});
		return id;
	}

	async getNode(id: string): Promise<ClassifierNode | null> {
		await this.ensureInit();
		const entity = await this.stores.sqlStoreService.getNode(id);
		if (!entity) return null;
		return {
			id: entity.id,
			parentId: entity.parentId,
			name: entity.name,
			slug: entity.slug,
		};
	}

	async getChildren(parentId: string): Promise<ClassifierNode[]> {
		await this.ensureInit();
		const entities = await this.stores.sqlStoreService.getChildren(parentId);
		return entities.map((e) => ({
			id: e.id,
			parentId: e.parentId,
			name: e.name,
			slug: e.slug,
		}));
	}

	async listRoots(): Promise<ClassifierNode[]> {
		await this.ensureInit();
		const entities = await this.stores.sqlStoreService.listRoots();
		return entities.map((e) => ({
			id: e.id,
			parentId: e.parentId,
			name: e.name,
			slug: e.slug,
		}));
	}

	async listNodes(
		params: PaginationParams,
	): Promise<PaginatedResult<ClassifierNode>> {
		await this.ensureInit();
		const result = await this.stores.sqlStoreService.listNodes(params);
		return {
			items: result.items.map((e) => ({
				id: e.id,
				parentId: e.parentId,
				name: e.name,
				slug: e.slug,
			})),
			totalCount: result.totalCount,
		};
	}

	async listTreeChildren(
		parentId?: string | null,
	): Promise<ClassifierTreeNode[]> {
		await this.ensureInit();
		const entities =
			await this.stores.sqlStoreService.listTreeChildren(parentId);
		return entities.map((e) => ({
			id: e.id,
			parentId: e.parentId,
			name: e.name,
			slug: e.slug,
			childrenCount: Number(e.childrenCount ?? 0),
		}));
	}

	async setMapping(mapping: ClassifierMappingInput): Promise<string> {
		await this.ensureInit();
		const id = mapping.id || randomUUID();
		return this.stores.sqlStoreService.setMapping({
			id,
			groupId: mapping.groupId,
			key: mapping.key,
			value: mapping.value,
			priority: mapping.priority,
		});
	}

	async getMapping(
		groupId: string,
		key: string,
	): Promise<ClassifierMapping | null> {
		await this.ensureInit();
		const entity = await this.stores.sqlStoreService.getMapping(groupId, key);
		if (!entity) return null;
		return this.toMapping(entity);
	}

	async resolveMapping(groupId: string, key: string): Promise<string | null> {
		await this.ensureInit();
		const entity = await this.stores.sqlStoreService.getMapping(groupId, key);
		return entity?.value ?? null;
	}

	async listMappings(groupId: string): Promise<ClassifierMapping[]> {
		await this.ensureInit();
		const entities = await this.stores.sqlStoreService.listMappings(groupId);
		return entities.map((entity) => this.toMapping(entity));
	}

	async listMappingGroups(): Promise<ClassifierMappingGroup[]> {
		await this.ensureInit();
		const entities = await this.stores.sqlStoreService.listMappingGroups();
		return entities.map((entity) => ({
			groupId: entity.groupId,
			count: Number(entity.count ?? 0),
		}));
	}

	async deleteMapping(groupId: string, key: string): Promise<boolean> {
		await this.ensureInit();
		return this.stores.sqlStoreService.deleteMapping(groupId, key);
	}

	private toMapping(entity: {
		id: string;
		groupId: string;
		key: string;
		value: string;
		priority: number;
		createdAt: number;
		updatedAt: number;
	}): ClassifierMapping {
		return {
			id: entity.id,
			groupId: entity.groupId,
			key: entity.key,
			value: entity.value,
			priority: entity.priority,
			createdAt: new Date(entity.createdAt * 1000),
			updatedAt: new Date(entity.updatedAt * 1000),
		};
	}
}

export default ClassifierServiceImpl;
