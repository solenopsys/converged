import { createFilesServiceClient } from "g-files";
import { createStoreServiceClient } from "g-store";

function filesClient() {
  return createFilesServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

function storeClient() {
  return createStoreServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

export async function downloadFileBytes(fileId: string): Promise<Uint8Array> {
  const chunks = await filesClient().getChunks(fileId);
  if (chunks.length === 0) throw new Error(`No chunks found for file ${fileId}`);

  const sorted = [...chunks].sort((a, b) => a.chunkNumber - b.chunkNumber);
  const parts = await Promise.all(sorted.map(c => storeClient().get(c.hash)));

  const total = parts.reduce((n, p) => n + p.byteLength, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.byteLength;
  }
  return result;
}
