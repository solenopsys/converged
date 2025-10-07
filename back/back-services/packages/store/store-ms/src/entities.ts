
import { PrefixedRepositoryKV, SimpleKey, Entity } from "back-core";
 
const STORE_PREFIX = "data";

class StoreKey extends SimpleKey {
    readonly prefix = STORE_PREFIX;
}

class StoreValue extends Uint8Array implements Entity {
    constructor(data: Uint8Array) {
        super(data);
    }
    extractKey(): string { 
        return Bun.hash(this).toString();
    }
}



class StoreRepository extends PrefixedRepositoryKV<StoreKey, StoreValue> {
    getPrefix(): string[] {
        return [STORE_PREFIX];
    }
}

export { STORE_PREFIX, StoreKey, StoreRepository, StoreValue };
