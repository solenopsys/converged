



 
import { LMWrapper } from "../utils/lmwrapper";
import { join } from "path";
import { mkdirSync } from "fs";
import { StoreType, Store } from "./types";
import { DATA_DIR } from "./types";


function createStore(msName: string, dbName: string, type: StoreType): Store {
    if (type==StoreType.KVS){
        const dir=join(DATA_DIR, msName, dbName);
        mkdirSync(dir, { recursive: true });
        return new LMWrapper(dir, "db");
    }

}

export { createStore,   }