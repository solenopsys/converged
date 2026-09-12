import { AccessTags, type SqlStore, visibleFrom } from "back-core";
import {
	type ChunkMetadataEntity,
	ChunkMetadataRepository,
	type CompressionType,
} from "./entities";

export class ChunkMetadataService {
	private readonly repo: ChunkMetadataRepository;
	private readonly store: SqlStore;
	/**
	 * Who a block belongs to.
	 *
	 * The `owner` column holds whoever stored it first and stops being the truth
	 * the moment a second person stores the same bytes — which is normal here,
	 * because blocks are content-addressed and deduplicated. The tag relation
	 * holds all of them, and that is what a listing is narrowed by.
	 *
	 * Reads by hash are not narrowed: a SHA-256 is a 256-bit secret derived from
	 * the content, so asking for one is proof of already having had it. What the
	 * tags govern is enumeration — `list` and the statistics — and revocation.
	 */
	readonly access: AccessTags;

	constructor(store: SqlStore) {
		this.store = store;
		this.access = new AccessTags(store);
		this.repo = new ChunkMetadataRepository(store, "chunk_metadata", {
			primaryKey: "hash",
			extractKey: (chunk) => ({ hash: chunk.hash }),
			buildWhereCondition: (key) => ({ hash: key.hash }),
		});
	}

	async save(
		hash: string,
		size: number,
		originalSize: number,
		compression: CompressionType = "deflate",
		owner: string = "",
	): Promise<void> {
		const existing = await this.repo.findById({ hash });
		if (existing) {
			await this.repo.update({ hash }, { refCount: existing.refCount + 1 });
		} else {
			await this.repo.create({
				hash,
				size,
				originalSize,
				compression,
				refCount: 1,
				owner,
				createdAt: new Date().toISOString(),
			});
		}

		// Every storer of these bytes gets a tag, not just the first. The reference
		// count says how many holders there are; this says who they are.
		if (owner.trim()) await this.access.grantToUser(hash, owner.trim());
	}

	async get(hash: string): Promise<ChunkMetadataEntity | undefined> {
		return this.repo.findById({ hash });
	}

	/**
	 * Lets one holder go. The block survives while anybody else still holds it,
	 * and the departing holder's tag goes either way — a grant that outlives the
	 * reference is access nobody can see or take back.
	 */
	async decrementRef(hash: string, owner?: string): Promise<boolean> {
		const existing = await this.repo.findById({ hash });
		if (!existing) return false;

		if (owner?.trim()) await this.access.revokeFromUser(hash, owner.trim());

		if (existing.refCount <= 1) {
			await this.repo.delete({ hash });
			await this.access.dropObject(hash);
			return true;
		} else {
			await this.repo.update({ hash }, { refCount: existing.refCount - 1 });
			return false;
		}
	}

	async delete(hash: string): Promise<boolean> {
		const deleted = await this.repo.delete({ hash });
		if (deleted) await this.access.dropObject(hash);
		return deleted;
	}

	/**
	 * The blocks the caller holds. Enumeration is the part tags can defend here,
	 * and it is the part worth defending: a full block listing is a map of every
	 * file in the deployment.
	 */
	async list(
		limit: number,
		offset: number,
	): Promise<{ items: string[]; totalCount: number }> {
		const rows = await visibleFrom(this.store.db, "chunk_metadata", {
			idColumn: "hash",
		})
			.select("obj.hash")
			.orderBy("obj.createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const counted = await visibleFrom(this.store.db, "chunk_metadata", {
			idColumn: "hash",
		})
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (rows as Array<{ hash: string }>).map((row) => row.hash),
			totalCount: Number(counted?.count ?? 0),
		};
	}

	/** Totals over the caller's own blocks, by the same narrowing as `list`. */
	async statistic(): Promise<{ totalChunks: number; totalSize: number }> {
		const row = await visibleFrom(this.store.db, "chunk_metadata", {
			idColumn: "hash",
		})
			.select((eb: any) => [
				eb.fn.countAll().as("count"),
				eb.fn.sum("obj.size").as("size"),
			])
			.executeTakeFirst();

		return {
			totalChunks: Number(row?.count ?? 0),
			totalSize: Number(row?.size ?? 0),
		};
	}
}
