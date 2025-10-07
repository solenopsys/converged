



import {HashString, PaginatedResult, PaginationParams ,StoreService} from '../../../../../../types/store';
import { StoresController } from './stores';



const MS_ID = "store-ms";

export class StoreServiceImpl implements StoreService {
    stores: StoresController;

    constructor() {
       this.init();
    }

    async init(){
        this.stores = new StoresController(MS_ID);
        await this.stores.init();
    }

    async save(data:Uint8Array):Promise<HashString> {
        return this.stores.store.save(data);
    }

    async delete(hash:HashString):Promise<void> {
        return this.stores.store.delete(hash);
    }

    async get(hash:HashString):Promise<Uint8Array> {
        return this.stores.store.get(hash);
    }

    async list(params:PaginationParams):Promise<PaginatedResult<HashString>> {
        return this.stores.store.list(params);
    }

    async storeStatistic():Promise<any> {
        return this.stores.store.storeStatistic();
    }
}