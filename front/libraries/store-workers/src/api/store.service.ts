import { REQUEST_TIMEOUT } from '../../../files-state/src/config';
import type { HashString } from "./generated";
import type { CompressionType } from '../types';

type FetchLike = typeof fetch;

export interface CreateStoreServiceOptions {
  baseUrl?: string;
  fetchImpl?: FetchLike;
  requestTimeoutMs?: number;
}

export interface StoreService {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType): Promise<HashString>;
  get(hash: HashString): Promise<Uint8Array>;
  delete(hash: HashString): Promise<void>;
}

const DEFAULT_BASE_URL = '/services/store';

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

  async function save(data: Uint8Array, originalSize?: number, compression?: CompressionType): Promise<HashString> {
    // Конвертируем Uint8Array в base64 для JSON передачи
    const base64Data = uint8ArrayToBase64(data);

    const response = await withTimeout(
      fetchImpl(`${normalizedBase}/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: base64Data,
          originalSize: originalSize ?? data.length,
          compression: compression ?? 'none'
        }),
      }),
      requestTimeoutMs,
    );

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(`StoreService.save failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const result = await response.json();
    // Backend returns the hash directly as a string, not wrapped in { result: ... }
    const hash = typeof result === 'string' ? result : result.result;
    return hash as HashString;
  }

  async function get(hash: HashString): Promise<Uint8Array> {
    const response = await withTimeout(
      fetchImpl(`${normalizedBase}/get`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash }),
      }),
      requestTimeoutMs,
    );

    if (!response.ok) {
      const errorText = await safeReadText(response);
      throw new Error(`StoreService.get failed: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
    }

    const result = await response.json();
    // Конвертируем base64 обратно в Uint8Array
    return base64ToUint8Array(result.result);
  }

  async function deleteBlock(hash: HashString): Promise<void> {
    const response = await withTimeout(
      fetchImpl(`${normalizedBase}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ hash }),
      }),
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

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
