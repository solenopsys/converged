import { BaseKeyJson, BaseRepositoryJson, JsonStore } from "back-core";
import type {
	PaginatedResult,
	PhoneNumber,
	PhoneNumberId,
	PhoneNumberInput,
	PhoneNumberListParams,
	PhoneNumberUpdate,
} from "g-audio-gate";

class PhoneNumberKey extends BaseKeyJson {
	readonly type = "phone-number";
}

class PhoneNumberRepository extends BaseRepositoryJson<
	PhoneNumberKey,
	PhoneNumber
> {}

function nowIso(): string {
	return new Date().toISOString();
}

export class PhoneNumberStoreService {
	private readonly repo: PhoneNumberRepository;

	constructor(store: JsonStore) {
		this.repo = new PhoneNumberRepository(store);
	}

	async save(input: PhoneNumberInput): Promise<PhoneNumberId> {
		const id = crypto.randomUUID();
		const now = nowIso();
		const record: PhoneNumber = {
			id,
			kind: input.kind,
			phone: input.phone,
			label: input.label,
			enabled: input.enabled ?? true,
			primary: input.primary ?? false,
			gateway: input.kind === "ip-telephony" ? input.gateway : undefined,
			note: input.note,
			createdAt: now,
			updatedAt: now,
		};
		if (record.primary) await this.clearPrimaryExcept(id);
		await this.repo.save(new PhoneNumberKey(id), record);
		return id;
	}

	async update(id: PhoneNumberId, patch: PhoneNumberUpdate): Promise<void> {
		const existing = await this.repo.get(new PhoneNumberKey(id));
		if (!existing) throw new Error(`phone number not found: ${id}`);
		const kind = patch.kind ?? existing.kind;
		const updated: PhoneNumber = {
			...existing,
			...patch,
			id: existing.id,
			kind,
			gateway:
				kind === "ip-telephony"
					? (patch.gateway ?? existing.gateway)
					: undefined,
			createdAt: existing.createdAt,
			updatedAt: nowIso(),
		};
		if (updated.primary) await this.clearPrimaryExcept(id);
		await this.repo.save(new PhoneNumberKey(id), updated);
	}

	async get(id: PhoneNumberId): Promise<PhoneNumber | undefined> {
		return this.repo.get(new PhoneNumberKey(id));
	}

	async delete(id: PhoneNumberId): Promise<boolean> {
		return this.repo.delete(new PhoneNumberKey(id));
	}

	async list(
		params: PhoneNumberListParams,
	): Promise<PaginatedResult<PhoneNumber>> {
		let items = await this.repo.listAll();
		if (params.kind) items = items.filter((p) => p.kind === params.kind);
		if (params.enabledOnly) items = items.filter((p) => p.enabled);
		items.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
		const totalCount = items.length;
		const offset = params.offset ?? 0;
		const limit = params.limit ?? items.length;
		return { items: items.slice(offset, offset + limit), totalCount };
	}

	async getPrimary(): Promise<PhoneNumber | undefined> {
		const items = (await this.repo.listAll()).filter((p) => p.enabled);
		return items.find((p) => p.primary) ?? items[0];
	}

	private async clearPrimaryExcept(keepId: string): Promise<void> {
		const all = await this.repo.listAll();
		for (const p of all) {
			if (p.id !== keepId && p.primary) {
				await this.repo.save(new PhoneNumberKey(p.id), {
					...p,
					primary: false,
					updatedAt: nowIso(),
				});
			}
		}
	}
}
