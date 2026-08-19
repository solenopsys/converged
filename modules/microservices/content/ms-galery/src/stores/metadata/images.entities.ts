import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface GaleryImageKey extends KeySQL {
  id: string;
}

export interface GaleryImageEntity {
  id: string;
  galeryId: string;
  title?: string | null;
  description?: string | null;
  originalName?: string | null;
  mimeType?: string | null;
  filePath: string;
  thumbPath: string;
  createdAt: ISODateString;
}

export class GaleryImageRepository extends BaseRepositorySQL<
  GaleryImageKey,
  GaleryImageEntity
> {}
