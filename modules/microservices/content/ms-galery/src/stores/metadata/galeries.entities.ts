import { BaseRepositorySQL, KeySQL } from "back-core";
import type { ISODateString } from "../../types";

export interface GaleryKey extends KeySQL {
  id: string;
}

export interface GaleryEntity {
  id: string;
  name: string;
  description?: string | null;
  createdAt: ISODateString;
}

export class GaleryRepository extends BaseRepositorySQL<
  GaleryKey,
  GaleryEntity
> {}
