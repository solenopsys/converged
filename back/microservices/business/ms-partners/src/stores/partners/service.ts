import { SqlStore, generateULID } from "back-core";
import { PartnerRepository } from "./entities";
import type {
  Partner,
  PartnerInput,
  PartnerUpdate,
  PartnerId,
  PartnerListParams,
  PaginatedResult,
} from "../../types";
import type { PartnerEntity } from "./entities";

export class PartnersStoreService {
  private readonly repo: PartnerRepository;

  constructor(private store: SqlStore) {
    this.repo = new PartnerRepository(store, "partners", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async createPartner(input: PartnerInput): Promise<PartnerId> {
    const id = generateULID();
    const now = new Date().toISOString();
    const entity: PartnerEntity = {
      id,
      kind: input.kind,
      name: input.name,
      contact: input.contact ?? null,
      tags: this.serializeTags(input.tags),
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    };

    await this.repo.create(entity as any);
    return id;
  }

  async getPartner(id: PartnerId): Promise<Partner | undefined> {
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toPartner(entity);
  }

  async updatePartner(id: PartnerId, patch: PartnerUpdate): Promise<void> {
    const existing = await this.repo.findById({ id });
    if (!existing) {
      throw new Error(`Partner not found: ${id}`);
    }

    const update: Partial<PartnerEntity> = {
      updatedAt: new Date().toISOString(),
    };

    if (patch.kind !== undefined) {
      update.kind = patch.kind;
    }
    if (patch.name !== undefined) {
      update.name = patch.name;
    }
    if (patch.contact !== undefined) {
      update.contact = patch.contact ?? null;
    }
    if (patch.tags !== undefined) {
      update.tags = this.serializeTags(patch.tags);
    }
    if (patch.note !== undefined) {
      update.note = patch.note ?? null;
    }

    await this.repo.update({ id }, update);
  }

  async deletePartner(id: PartnerId): Promise<boolean> {
    return this.repo.delete({ id });
  }

  async listPartners(
    params: PartnerListParams,
  ): Promise<PaginatedResult<Partner>> {
    const limit = params.limit ?? 50;
    const offset = params.offset ?? 0;

    let query = this.store.db.selectFrom("partners").selectAll();

    if (params.kind) {
      query = query.where("kind", "=", params.kind);
    }

    const textQuery = params.query?.trim();
    if (textQuery) {
      const pattern = `%${textQuery}%`;
      query = query.where((eb) =>
        eb.or([
          eb("name", "like", pattern),
          eb("contact", "like", pattern),
          eb("note", "like", pattern),
        ]),
      );
    }

    const items = await query
      .orderBy("updatedAt", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

    let countQuery = this.store.db
      .selectFrom("partners")
      .select(({ fn }) => fn.countAll().as("count"));

    if (params.kind) {
      countQuery = countQuery.where("kind", "=", params.kind);
    }

    if (textQuery) {
      const pattern = `%${textQuery}%`;
      countQuery = countQuery.where((eb) =>
        eb.or([
          eb("name", "like", pattern),
          eb("contact", "like", pattern),
          eb("note", "like", pattern),
        ]),
      );
    }

    const countResult = await countQuery.executeTakeFirst();
    const totalCount = Number(countResult?.count ?? 0);

    return {
      items: (items as PartnerEntity[]).map((item) => this.toPartner(item)),
      totalCount,
    };
  }

  private serializeTags(value?: string[]): string {
    return JSON.stringify(value ?? []);
  }

  private parseTags(value?: string | null): string[] {
    if (!value) {
      return [];
    }
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private toPartner(entity: PartnerEntity): Partner {
    const contact = entity.contact ?? undefined;
    const note = entity.note ?? undefined;
    const tags = this.parseTags(entity.tags);

    return {
      id: entity.id,
      kind: entity.kind,
      name: entity.name,
      contact: contact && contact.length ? contact : undefined,
      tags,
      note: note && note.length ? note : undefined,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }
}
