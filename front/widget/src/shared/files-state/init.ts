import { services, setStoreWorker } from "files-state";
import { filesClient, storeClient, workspaceHeaders } from "../../services";
import StoreWorker from "../../../../libraries/store-workers/src/workers/store.worker.ts?worker";

let initialized = false;

export function initFilesState() {
  if (initialized) {
    return;
  }

  const worker = new StoreWorker();

  setStoreWorker(worker, { baseUrl: '/services/store', headers: workspaceHeaders });

  services.setFilesService(filesClient);
  services.setStoreService(storeClient);

  console.log('[Widget] Files state initialized');

  initialized = true;
}
