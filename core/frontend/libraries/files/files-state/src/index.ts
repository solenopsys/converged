// Services
export { services } from './services';

// Core modules
export * from './segments/files';
export * from './segments/store';
export * from './segments/streaming';
export * from './segments/browser';
export * from './segments/ui';
export * from './domain';

// API
export type { StoreService } from './store-service';

export { downloadFile } from './download';

// Worker control
export { setStoreWorker, terminateWorkers } from './segments/streaming';

import './integrations';
