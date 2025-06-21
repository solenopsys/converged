// server.ts
 import { server } from "./server";
 import process from "process";
  
 server.listen(process.env.PORT || 3000);

console.log(`Server: http://localhost:3000`);
console.log(`Docs: http://localhost:3000/docs`);

process.on("SIGINT", async () => {
  await providers.deinit();
  sqlite.close();
  process.exit(0);
});