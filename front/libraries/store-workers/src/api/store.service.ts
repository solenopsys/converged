import { REQUEST_TIMEOUT } from '../../../files-state/src/config';
import {
  createStoreServiceClient,
  type StoreServiceClient,
} from 'g-store';
import type { HashString } from "./generated";
import type { CompressionType } from '../types';

export interface CreateStoreServiceOptions {
  baseUrl?: string;
  headers?: Record<string, string>;
  requestTimeoutMs?: number;
  owner?: string;
}

export interface StoreService {
  save(data: Uint8Array, originalSize?: number, compression?: CompressionType): Promise<HashString>;
  get(hash: HashString): Promise<Uint8Array>;
  delete(hash: HashString): Promise<void>;
}

const DEFAULT_BASE_URL = '/services';

function normalizeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.replace(/\/+$/, '');
  return normalized.endsWith('/store')
    ? normalized.slice(0, -'/store'.length)
    : normalized;
}

function normalizeHash(result: unknown): HashString {
  if (typeof result === 'string') return result as HashString;
  if (result && typeof result === 'object' && typeof (result as any).result === 'string') {
    return (result as any).result as HashString;
  }
  throw new Error(`StoreService.save returned invalid hash: ${String(result)}`);
}

function normalizeBytes(result: unknown): Uint8Array {
  if (result instanceof Uint8Array) return result;
  if (Array.isArray(result)) return new Uint8Array(result);
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result && typeof result === 'object') {
    const value = (result as any).result ?? (result as any).data;
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (Array.isArray(value)) return new Uint8Array(value);
  }
  throw new Error('StoreService.get returned invalid bytes');
}

export function createStoreService(options: CreateStoreServiceOptions = {}): StoreService {
  const {
    baseUrl = DEFAULT_BASE_URL,
    headers = {},
    owner,
    requestTimeoutMs = REQUEST_TIMEOUT,
  } = options;

  const client: StoreServiceClient = createStoreServiceClient({
    baseUrl: normalizeBaseUrl(baseUrl),
    headers,
    timeout: requestTimeoutMs,
  } as any);

  async function save(data: Uint8Array, originalSize?: number, compression?: CompressionType): Promise<HashString> {
    const hash = await client.save(
      data,
      originalSize ?? data.length,
      compression ?? 'none',
      owner,
    );
    return normalizeHash(hash);
  }

  async function get(hash: HashString): Promise<Uint8Array> {
    return normalizeBytes(await client.get(hash));
  }

  async function deleteBlock(hash: HashString): Promise<void> {
    await client.delete(hash);
  }

  return {
    save,
    get,
    delete: deleteBlock,
  };
}
