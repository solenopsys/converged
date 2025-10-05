
import { KVStore } from "./kv-store";

import { KEY_SEPARATOR  } from '../../utils';


export abstract class EntityAcessor<T> { 
  constructor(protected db: KVStore, protected store: T) { }

  getLastVersion(prefixArray: string[]) {
    const keys = this.db.getKeysWithPrefix(prefixArray);
    if (keys.length==0){
      return undefined;
    }
    const lastKey = keys[keys.length - 1];
    const version = lastKey.split(KEY_SEPARATOR)[2];
    return version;
  }


  listKeys(arrPrefix:string[],splitNumber:number): string[] {
    const keys = this.db.getKeysWithPrefix(arrPrefix);
    const names: Set<string> = new Set();
    for (const key of keys) {
      const name = key.split(KEY_SEPARATOR)[splitNumber];
      names.add(name);
    }
    return Array.from(names);
  }
}
