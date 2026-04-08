import { JsonStore, BaseRepositoryJson, BaseKeyJson } from "back-core";
import type { NotifyChannel, NotifyChannelId, NotifyChannelInput } from "../../types";

class ChannelKey extends BaseKeyJson {
  readonly type = "channel";
}

class NotifyChannelRepository extends BaseRepositoryJson<ChannelKey, NotifyChannelInput> {}

export class NotifyChannelStoreService {
  private readonly repo: NotifyChannelRepository;

  constructor(store: JsonStore) {
    this.repo = new NotifyChannelRepository(store);
  }

  async save(channel: NotifyChannelInput): Promise<NotifyChannelId> {
    await this.repo.save(new ChannelKey(channel.id), channel);
    return channel.id;
  }

  async get(id: NotifyChannelId): Promise<NotifyChannel | undefined> {
    return this.repo.get(new ChannelKey(id));
  }

  async list(): Promise<NotifyChannel[]> {
    return this.repo.listAll();
  }

  async delete(id: NotifyChannelId): Promise<boolean> {
    return this.repo.delete(new ChannelKey(id));
  }
}
