
import type { StoreService } from './store.service';

const chunks = new Map<string, Uint8Array>();

export function createStoreService(): StoreService {
  return {
    save: async (data: Uint8Array) => {
      const hash = await crypto.subtle.digest('SHA-256', data).then(b => Buffer.from(b).toString('hex'));
      chunks.set(hash, data);
      return hash as any;
    },
    get: async (hash: string) => {
      if (chunks.has(hash)) {
        return chunks.get(hash)!;
      }
      throw new Error('Not Found');
    },
    delete: async (hash: string) => {
      chunks.delete(hash);
    },
  };
}
