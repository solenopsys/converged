import { StorageConnection } from "../back/native/bun-transport/src/index";
const conn = new StorageConnection('/tmp/storage-socket/storage.sock');
const stores = conn.listStores();
console.log('LIST_OK', stores.length);
conn.close();
