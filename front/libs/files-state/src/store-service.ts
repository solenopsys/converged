import { HashString } from "../../../../types/files";

export interface StoreService {
  save(data: Uint8Array): Promise<HashString>;
  get(hash: HashString): Promise<Uint8Array>;
  delete?(hash: HashString): Promise<void>;
}
