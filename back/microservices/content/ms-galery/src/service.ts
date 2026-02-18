import type {
  GaleryService,
  Galery,
  GaleryId,
  GaleryInput,
  GaleryImage,
  GaleryImageId,
  GaleryImageInput,
  PaginationParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "galery-ms";

export class GaleryServiceImpl implements GaleryService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createGalery(input: GaleryInput): Promise<GaleryId> {
    await this.ready();
    return this.stores.galeries.create(input);
  }

  async getGalery(id: GaleryId): Promise<Galery | null> {
    await this.ready();
    return this.stores.galeries.get(id);
  }

  async listGaleries(
    params: PaginationParams,
  ): Promise<PaginatedResult<Galery>> {
    await this.ready();
    return this.stores.galeries.list(params);
  }

  async deleteGalery(id: GaleryId): Promise<boolean> {
    await this.ready();
    return this.stores.galeries.delete(id);
  }

  async saveImage(input: GaleryImageInput): Promise<GaleryImage> {
    await this.ready();

    const { filePath, thumbPath } =
      await this.stores.filesService.saveImageWithThumbnail(
        input.data,
        input.originalName,
        input.mimeType,
      );

    return this.stores.images.create(input, filePath, thumbPath);
  }

  async getImage(id: GaleryImageId): Promise<GaleryImage | null> {
    await this.ready();
    return this.stores.images.get(id);
  }

  async listImages(
    galeryId: GaleryId,
    params: PaginationParams,
  ): Promise<PaginatedResult<GaleryImage>> {
    await this.ready();
    return this.stores.images.listByGalery(galeryId, params);
  }

  async deleteImage(id: GaleryImageId): Promise<boolean> {
    await this.ready();
    const image = await this.stores.images.get(id);
    if (!image) {
      return false;
    }

    await this.stores.filesService.deleteImage(
      image.filePath,
      image.thumbPath,
    );
    return this.stores.images.delete(id);
  }
}

export default GaleryServiceImpl;
