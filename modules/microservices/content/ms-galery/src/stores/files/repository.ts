import { BaseRepositoryFile, FileStore } from "back-core";
import { GaleryFileKey } from "./keys";

export class GaleryFilesRepository extends BaseRepositoryFile<GaleryFileKey> {
  constructor(store: FileStore) {
    super(store);
  }
}
