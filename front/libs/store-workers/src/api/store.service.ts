import { REQUEST_TIMEOUT } from '../../../files-state/src/config';
import type { StoreService } from '../../../files-state/src/store-service';
export type { StoreService };
import { HashString } from "../../../../../types/files";

type FetchLike = typeof fetch;

export interface CreateStoreServiceOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  requestTimeoutMs?: number;
}

const DEFAULT_BASE_URL = 'http://localhost:10001';

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) {
    return promise;
  }

  let timeoutId: ReturnType<typeof setTimeout>;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`StoreService request timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId!);
  }
}

export function createStoreService(options: CreateStoreServiceOptions = {}): StoreService {
  const {
    baseUrl = DEFAULT_BASE_URL,
    fetchImpl = fetch,
    requestTimeoutMs = REQUEST_TIMEOUT,
  } = options;

  const normalizedBase = baseUrl.replace(/\/+$/, '');

  async function save(data: Uint8Array): Promise<HashString> {
    const response = await withTimeout(
      fetchImpl(`${normalizedBase}`, {
        method: 'PUT',
        body: data,
      }),
      requestTimeoutMs,
    );

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(`StoreService.save failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const hash = (await response.text()).trim();
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      throw new Error(`StoreService.save returned invalid hash: "${hash}"`);
    }

    return hash as HashString;
  }

  async function get(hash: HashString): Promise<Uint8Array> {
    const response = await withTimeout(fetchImpl(`${normalizedBase}/${hash}`), requestTimeoutMs);

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(`StoreService.get failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const buffer = await response.arrayBuffer();
    return new Uint8Array(buffer);
  }

  async function deleteBlock(hash: HashString): Promise<void> {
    const response = await withTimeout(
      fetchImpl(`${normalizedBase}/${hash}`, { method: 'DELETE' }),
      requestTimeoutMs,
    );

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(`StoreService.delete failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }
  }

  return {
    save,
    get,
    delete: deleteBlock,
  };
}

async function safeReadText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return '';
  }
}
