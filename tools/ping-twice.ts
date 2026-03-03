import { StorageConnection } from "../back/native/bun-transport/src/index";
const conn = new StorageConnection('/tmp/storage-socket/storage.sock');
conn.ping();
console.log('PING1');
conn.ping();
console.log('PING2');
conn.close();
