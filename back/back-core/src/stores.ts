


enum StoreType {
    SQL = "SQL",
    FILES = "FILES",
    COLUMN = "COLUMN",
    KVS = "KEY_VALUE",
}

interface Entity {
    id: string
}

interface Store {

}
import { LMWrapper } from "./utils/lmwrapper";
import { join } from "path";
import { mkdirSync } from "fs";

const DATA_DIR="./data"

function createStore(msName: string, dbName: string, type: StoreType): Store {
    if (type==StoreType.KVS){
        const dir=join(DATA_DIR, msName, dbName);
        mkdirSync(dir, { recursive: true });
        return new LMWrapper(msName, "database.lmdb");
    }

}

export { createStore, StoreType, type Entity ,type Store }