import { StorageConnection } from "../back/native/bun-transport/src/index";

const conn = new StorageConnection("/tmp/storage-socket/storage.sock");
conn.ping();
console.log("ping ok");

for (let i = 0; i < 200; i++) {
  conn.open("usage-ms", "usage", "sql");
  if (i % 20 === 0) console.log("open", i);
}

console.log("done");
conn.close();
