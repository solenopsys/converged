import { Storage } from './storage';
import { Dumper } from './dumper';
import { Query } from './query';
import { HttpServer } from './http';

async function main() {
  const storage = new Storage();
  const dumper = new Dumper();
  const query = new Query();
  
  await dumper.init();
  
  const server = new HttpServer(storage, query);
  server.start(3009);
  
  // Дамп каждую минуту
  setInterval(async () => {
    const logs = storage.getAll();
    if (logs.length > 0) {
      await dumper.dump(logs);
      storage.clear();
      console.log(`Dumped ${logs.length} logs`);
    }
  }, 60000);
}

main().catch(console.error);