import { StorageConnection } from "../back/native/bun-transport/src/index";
const conn: any = new StorageConnection('/tmp/storage-socket/storage.sock');
console.log('FD0', conn.fd);
conn.ping();
console.log('FD1', conn.fd);
try { conn.ping(); console.log('FD2', conn.fd); } catch (e) { console.log('ERR', e); console.log('FDERR', conn.fd); }
