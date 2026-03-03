import { StorageConnection } from "../back/native/bun-transport/src/index";
const conn = new StorageConnection('/tmp/storage-socket/storage.sock');
conn.ping();
console.log('PING_OK');
setTimeout(() => { conn.close(); }, 100);
