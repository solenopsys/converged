import { imageMimeFromPath } from "back-core";
import { Access, getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";
import type {
	CachedImageRef,
	Galery,
	GaleryId,
	GaleryImage,
	GaleryImageId,
	GaleryImageInput,
	GaleryInput,
	GaleryService,
	PaginatedResult,
	PaginationParams,
} from "./types";

const REPOSITORY_ID = "rp-galery";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) throw new Error("Authenticated caller is required");
	return actor;
}
// File reads materialize the content in shared Valkey; only the cache key
// crosses the service boundary.
export class GaleryServiceImpl implements GaleryService {
	private stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	private async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	// Every method carries a deliberate level: an undecorated one also resolves
	// to `"user"`, so the decorator is what separates a decision from an
	// oversight.
	async createGalery(input: GaleryInput): Promise<GaleryId> {
		await this.ready();
		return this.stores.galeries.create(input, requireActor());
	}

	async getGalery(id: GaleryId): Promise<Galery | null> {
		await this.ready();
		return this.stores.galeries.get(id);
	}

	async listGaleries(
		params: PaginationParams,
	): Promise<PaginatedResult<Galery>> {
		await this.ready();
		return this.stores.galeries.list(params);
	}

	async deleteGalery(id: GaleryId): Promise<boolean> {
		await this.ready();
		return this.stores.galeries.delete(id);
	}

	/**
	 * Stores an image and files it under a gallery.
	 *
	 * The write check comes before the bytes are written: the file store keeps
	 * no tags of its own, so a thumbnail produced for a gallery the caller
	 * cannot touch is disk spent on nothing plus a file nobody will reach.
	 */
	async saveImage(input: GaleryImageInput): Promise<GaleryImage> {
		await this.ready();
		const actor = requireActor();
		await this.stores.galeries.access.requireWrite(input.galeryId);

		const { filePath, thumbPath } =
			await this.stores.filesService.saveImageWithThumbnail(
				input.data,
				input.originalName,
				input.mimeType,
			);

		return this.stores.images.create(input, filePath, thumbPath, actor);
	}

	async getImage(id: GaleryImageId): Promise<GaleryImage | null> {
		await this.ready();
		return this.stores.images.get(id);
	}

	async listImages(
		galeryId: GaleryId,
		params: PaginationParams,
	): Promise<PaginatedResult<GaleryImage>> {
		await this.ready();
		return this.stores.images.listByGalery(galeryId, params);
	}

	async deleteImage(id: GaleryImageId): Promise<boolean> {
		await this.ready();
		const image = await this.stores.images.get(id);
		if (!image) {
			return false;
		}

		// `delete` re-checks the write tag; the bytes go first because a record
		// without its file is worse than a file without its record.
		await this.stores.images.access.requireWrite(id);
		await this.stores.filesService.deleteImage(image.filePath, image.thumbPath);
		return this.stores.images.delete(id);
	}

	@Access("internal")
	async ensureStaticCached(path: string): Promise<CachedImageRef | null> {
		await this.ready();
		const ref = await this.stores.static.get(path);
		if (!ref) {
			return null;
		}

		return {
			cacheKey: ref.cacheKey,
			contentType: imageMimeFromPath(path),
		};
	}
}

export default GaleryServiceImpl;
