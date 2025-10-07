
import { KVStore, newULID, type ULID } from "back-core"; 
import {HashString, PaginatedResult, PaginationParams } from '../../../../../../../types/store';

import { StoreRepository, StoreKey, StoreValue } from "../entities";


export class StoreKVService {
    private repository: StoreRepository;

    constructor(private store: KVStore) {
        this.repository = new StoreRepository(store);
    }

    async save(data: Uint8Array): Promise<HashString> {
        const hash = newULID();
        const key = new StoreKey(hash);
        await this.repository.save(key,new StoreValue(data));
        return hash;
    }

    async delete(hash: HashString): Promise<void> {
        const key = new StoreKey(hash);
        await this.repository.delete(key);
    }

    async get(hash: HashString): Promise<Uint8Array> {
        const key = new StoreKey(hash);
        return await this.repository.get(key);
    }

    async list(params: PaginationParams): Promise<PaginatedResult<HashString>> {
        // This is a simplified list implementation. 
        // A proper implementation would need to handle pagination from the repository.
        // const all = await this.repository.listKeys(params);
        // const items = all.keys.map(key => key.id);
        // return {
        //     items: items,
        //     totalCount: items.length
        // };

        throw new Error("Not implemented");
    }

    async storeStatistic(): Promise<any> {
        return await this.store.db.getStats();
    }
}
