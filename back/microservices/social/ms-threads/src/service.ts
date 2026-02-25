export { StoreType, createStore, newULID } from "back-core";
import { StoresController } from "./stores";
import type { ULID, Message, ThreadsService } from "g-threads";

const MS_ID = "threads-ms";

export default class ThreadsServiceImpl implements ThreadsService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  async saveMessage(message: Message): Promise<string> {
    return this.stores.threads.saveMessage(message);
  }

  async readMessage(threadId: ULID, messageId: ULID): Promise<Message> {
    return this.stores.threads.readMessage(threadId, messageId) as Message;
  }

  async readMessageVersions(
    threadId: ULID,
    messageId: ULID,
  ): Promise<Message[]> {
    return this.stores.threads.readMessageVersions(
      threadId,
      messageId,
    ) as Message[];
  }

  async readThreadAllVersions(threadId: ULID): Promise<Message[]> {
    return this.stores.threads.readThreadAllVersions(threadId) as Message[];
  }

  async readThread(threadId: ULID): Promise<Message[]> {
    return this.stores.threads.readThread(threadId) as Message[];
  }
}
