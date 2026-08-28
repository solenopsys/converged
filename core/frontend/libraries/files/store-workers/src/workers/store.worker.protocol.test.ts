import { describe, expect, test } from "bun:test";
import {
  UploadWorkerCommandType,
  UploadWorkerEventType,
  type UploadWorkerOutgoingMessage,
} from "../types";

describe("store worker protocol", () => {
  test("stages blobs over HTTP and sends only cache references to the parent", async () => {
    let uploadNumber = 0;
    const server = Bun.serve({
      port: 0,
      async fetch(request) {
        expect(new URL(request.url).pathname).toBe("/cache/blob");
        expect(request.method).toBe("POST");
        const sizeBytes = (await request.arrayBuffer()).byteLength;
        uploadNumber += 1;
        return Response.json({ cacheKey: `cache:test:${uploadNumber}`, sizeBytes });
      },
    });
    const worker = new Worker(new URL("./store.worker.ts", import.meta.url), {
      type: "module",
    });
    const file = new File([new Uint8Array(600 * 1024)], "input.bin");
    const chunks: Array<Extract<UploadWorkerOutgoingMessage, {
      type: UploadWorkerEventType.ChunkPrepared;
    }>> = [];

    await new Promise<void>((resolve, reject) => {
      worker.onmessage = (event: MessageEvent<UploadWorkerOutgoingMessage>) => {
        const message = event.data;
        if (message.type === UploadWorkerEventType.Error) {
          reject(new Error(message.error));
          return;
        }
        if (message.type === UploadWorkerEventType.ChunkPrepared) {
          chunks.push(message);
          worker.postMessage({
            type: UploadWorkerCommandType.ChunkConsumed,
            fileId: message.fileId,
            chunkNumber: message.chunkNumber,
          });
          return;
        }
        if (message.type === UploadWorkerEventType.FileUploaded) resolve();
      };

      worker.postMessage({
        type: UploadWorkerCommandType.UploadStart,
        fileId: "file-1",
        file,
        cacheBlobUrl: `http://127.0.0.1:${server.port}/cache/blob`,
      });
    });

    worker.terminate();
    server.stop(true);
    expect(chunks).toHaveLength(2);
    expect(chunks.map(({ dataRef }) => dataRef.cacheKey)).toEqual([
      "cache:test:1",
      "cache:test:2",
    ]);
    expect(chunks.every((chunk) => !("data" in chunk))).toBe(true);
    expect(chunks.map(({ chunkNumber }) => chunkNumber)).toEqual([0, 1]);
  });
});
