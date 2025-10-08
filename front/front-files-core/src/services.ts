import { FilesService } from "../../../types/files";
import { StoreService } from "../../../types/store";

class Services {
  private static instance: Services;
  private _filesService: FilesService | null = null;
  private _storeService: StoreService | null = null;

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

  setStoreService(service: StoreService) {
    this._storeService = service;
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
}

export const services = Services.getInstance();