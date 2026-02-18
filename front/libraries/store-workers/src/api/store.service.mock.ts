import type { StoreService } from './store.service';
import type { CompressionType } from '../types';

const chunks = new Map<string, Uint8Array>();

export function createStoreService(): StoreService {
  return {
    save: async (data: Uint8Array, originalSize?: number, compression?: CompressionType) => {
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
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
