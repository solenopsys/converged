export type GaleryId = string;
export type GaleryImageId = string;
export type ISODateString = string;

export type Galery = {
  id: GaleryId;
  name: string;
  description?: string;
  createdAt: ISODateString;
};

export type GaleryInput = {
  name: string;
  description?: string;
};

export type GaleryImage = {
  id: GaleryImageId;
  galeryId: GaleryId;
  title?: string;
  description?: string;
  originalName?: string;
  mimeType?: string;
  filePath: string;
  thumbPath: string;
  createdAt: ISODateString;
};

export type GaleryImageInput = {
  galeryId: GaleryId;
  data: Uint8Array;
  mimeType?: string;
  originalName?: string;
  title?: string;
  description?: string;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export interface GaleryService {
  createGalery(input: GaleryInput): Promise<GaleryId>;
  getGalery(id: GaleryId): Promise<Galery | null>;
  listGaleries(params: PaginationParams): Promise<PaginatedResult<Galery>>;
  deleteGalery(id: GaleryId): Promise<boolean>;

  saveImage(input: GaleryImageInput): Promise<GaleryImage>;
  getImage(id: GaleryImageId): Promise<GaleryImage | null>;
  listImages(
    galeryId: GaleryId,
    params: PaginationParams,
  ): Promise<PaginatedResult<GaleryImage>>;
  deleteImage(id: GaleryImageId): Promise<boolean>;
}
