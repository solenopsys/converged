import { IndexStore } from "./old/index.store";
import { SchemeStore } from "./dag/scheme-new.store";
import { ProcessingStore } from "./processing.store";
import { createStore, StoreType } from "back-core";
import type { KVStore } from "back-core";

class StoreController {
  private static instance: StoreController;

  public readonly scheme: SchemeStore;
  public readonly processing: ProcessingStore;
  private schemeKvStore: KVStore;
  private processingKvStore: KVStore;

  private constructor() {
    // Инициализация синхронная, но нужно вызвать async init() после создания
  }

  async init() {
    const msName = "dag-core";

    // Создаем KV хранилища через централизованную фабрику
    this.schemeKvStore = (await createStore(
      msName,
      "scheme",
      StoreType.KVS,
      [],
    )) as KVStore;
    this.processingKvStore = (await createStore(
      msName,
      "processing",
      StoreType.KVS,
      [],
    )) as KVStore;

    // Открываем хранилища
    await this.schemeKvStore.open();
    await this.processingKvStore.open();

    // Создаем store обертки
    (this as any).scheme = new SchemeStore(this.schemeKvStore);
    (this as any).processing = new ProcessingStore(this.processingKvStore);
  }

  async close() {
    await this.scheme?.close();
    await this.processing?.deinit();
  }

  public static async getInstance(): Promise<StoreController> {
    if (!StoreController.instance) {
      StoreController.instance = new StoreController();
      await StoreController.instance.init();
    }
    return StoreController.instance;
  }
}

export { StoreController };
