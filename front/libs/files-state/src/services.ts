import { FilesService } from "../../../../types/files";
import type { CreateStoreServiceOptions } from '../../store-workers/src/api/store.service';
import { StoreService } from "./store-service";

class Services {
  private static instance: Services;
  private _filesService: FilesService | null = null;
  private _storeService: StoreService | null = null;
  private _storeWorkerOptions: CreateStoreServiceOptions | null = null;

  private constructor() {}

  static getInstance(): Services {
    if (!Services.instance) {
      Services.instance = new Services();
    }
    return Services.instance;
  }

  setFilesService(service: FilesService) {
    this._filesService = service;
  }

  setStoreService(service: StoreService, options?: CreateStoreServiceOptions) {
    this._storeService = service;
    if (options) {
      this._storeWorkerOptions = options;
    }
  }

  setStoreWorkerOptions(options: CreateStoreServiceOptions) {
    this._storeWorkerOptions = options;
  }

  get filesService(): FilesService {
    if (!this._filesService) {
      throw new Error('FilesService not initialized');
    }
    return this._filesService;
  }

  get storeService(): StoreService {
    if (!this._storeService) {
      throw new Error('StoreService not initialized');
    }
    return this._storeService;
  }

  get storeWorkerOptions(): CreateStoreServiceOptions | null {
    return this._storeWorkerOptions;
  }
}

export const services = Services.getInstance();
