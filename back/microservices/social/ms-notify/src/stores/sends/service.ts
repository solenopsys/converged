import { SqlStore, generateULID } from "back-core";
import { NotifySendRepository } from "./entities";
import type {
  NotifySend,
  NotifySendId,
  NotifySendInput,
} from "../../types";
import type { NotifySendEntity } from "./entities";

const DEFAULT_STATUS = "new";

export class NotifySendsStoreService {
  private readonly repo: NotifySendRepository;

  constructor(private store: SqlStore) {
    this.repo = new NotifySendRepository(store, "notify_sends", {
      primaryKey: "id",
      extractKey: (entry) => ({ id: entry.id }),
      buildWhereCondition: (key) => ({ id: key.id }),
    });
  }

  async recordSend(input: NotifySendInput): Promise<NotifySendId> {
    const id = generateULID();
    const createdAt = new Date().toISOString();
    const entity: NotifySendEntity = {
      id,
      templateId: input.templateId,
      channel: input.channel,
      recipient: input.recipient,
      params: JSON.stringify(input.params ?? {}),
      status: input.status ?? DEFAULT_STATUS,
      createdAt,
    };

    await this.repo.create(entity as any);
    return id;
  }

  async getSend(id: NotifySendId): Promise<NotifySend | undefined> {
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toSend(entity);
  }

  async listSends(): Promise<NotifySend[]> {
    const items = await this.store.db
      .selectFrom("notify_sends")
      .selectAll()
      .orderBy("createdAt", "desc")
      .execute();

    return (items as NotifySendEntity[]).map((item) => this.toSend(item));
  }

  private toSend(entity: NotifySendEntity): NotifySend {
    const params = this.parseParams(entity.params);
    return {
      id: entity.id,
      templateId: entity.templateId,
      channel: entity.channel,
      recipient: entity.recipient,
      params,
      status: entity.status,
      createdAt: entity.createdAt,
    };
  }

  private parseParams(
    value: string | null | undefined,
  ): Record<string, string | number | boolean | null> {
    if (!value) {
      return {};
    }
    try {
      return JSON.parse(value);
    } catch {
      return {};
    }
  }
}
