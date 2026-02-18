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
export { createStoreService } from './api/store';
export type { StoreService } from './store-service';

// Worker control
export { setStoreWorker, terminateWorkers } from './segments/streaming';

// Integrations
import './integrations';
