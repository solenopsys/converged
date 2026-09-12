import {
  AccessTags,
  SqlStore,
  generateULID,
  personalTag,
  visibleFrom,
} from "back-core";
import { isServiceActor } from "nrpc";
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
  /**
   * Who may see which send.
   *
   * A send record says who was told what, and that is the addressee's business
   * and the sender's, so it is `private`. The record carries the tag of
   * whoever recorded it, and — when a service recorded it — the addressee's
   * too, so a person can see the notifications that were sent to them. A person
   * naming an addressee is not believed, because that would be opening their
   * own record to somebody else's tag.
   */
  readonly access: AccessTags;

  constructor(private store: SqlStore) {
    this.access = new AccessTags(store);
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
    const recipient = input.recipient?.trim();
    await this.access.tagNew(id, {
      visibility: "private",
      tags: recipient && isServiceActor() ? [personalTag(recipient)] : [],
    });
    return id;
  }

  /** A send the caller holds no tag for reads as absent. */
  async getSend(id: NotifySendId): Promise<NotifySend | undefined> {
    if (!(await this.access.canRead(id))) return undefined;
    const entity = await this.repo.findById({ id });
    if (!entity) {
      return undefined;
    }
    return this.toSend(entity);
  }

  /**
   * The sends the caller may see. Before the tags this returned the delivery
   * log of the whole installation — every addressee and every template they
   * were sent — to anyone who could call it.
   */
  async listSends(): Promise<NotifySend[]> {
    const items = await visibleFrom(this.store.db, "notify_sends")
      .selectAll("obj")
      .orderBy("obj.createdAt", "desc")
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
