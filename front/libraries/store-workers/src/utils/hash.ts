import type { HashString } from '../../../../../types/files';

export async function calculateHash(data: Uint8Array): Promise<HashString> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex as HashString;
}
