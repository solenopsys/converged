import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { MetadataStoreService } from "./stores/metadata/service";
import { SqlStore, InMemoryMigrationState } from "back-core";
import { FileMetadata, FileChunk } from "./types";
import CreateFilesMigration from "./stores/metadata/migrations/createFiles";
import filesPlugin from "./plugin";

describe("FilesService", () => {
  let store: SqlStore;
  let metadataService: MetadataStoreService;

  beforeAll(async () => {
    // Create in-memory SQLite store for testing
    store = new SqlStore(
      ":memory:",
      [CreateFilesMigration],
      new InMemoryMigrationState(),
    );
    await store.open();
    await store.migrate();

    metadataService = new MetadataStoreService(store);
  });

  afterAll(async () => {
    // Cleanup
  });

  describe("save", () => {
    it("should save file metadata", async () => {
      const file: FileMetadata = {
        id: "test-file-id-123",
        hash: "",
        status: "uploading",
        name: "test-file.png",
        fileSize: 1024,
        fileType: "image/png",
        compression: "deflate",
        owner: "anonymous",
        createdAt: new Date().toISOString(),
        chunksCount: 0,
      };

      const result = await metadataService.save(file);
      expect(result).toBe("test-file-id-123");

      // Verify it was saved
      const saved = await metadataService.get("test-file-id-123");
      expect(saved).toBeDefined();
      expect(saved?.name).toBe("test-file.png");
    });
  });

  describe("saveChunk", () => {
    it("should save file chunk", async () => {
      const chunk: FileChunk = {
        fileId: "test-file-id-123",
        hash: "abc123hash",
        chunkNumber: 0,
        chunkSize: 524288,
        createdAt: new Date().toISOString(),
      };

      const result = await metadataService.saveChunk(chunk);
      expect(result).toBe("abc123hash");

      // Verify it was saved
      const chunks = await metadataService.getChunks("test-file-id-123");
      expect(chunks.length).toBe(1);
      expect(chunks[0].hash).toBe("abc123hash");
    });
  });

  describe("getChunks", () => {
    it("should return chunks in order", async () => {
      // Save multiple chunks
      const chunk1: FileChunk = {
        fileId: "multi-chunk-file",
        hash: "hash1",
        chunkNumber: 0,
        chunkSize: 524288,
        createdAt: new Date().toISOString(),
      };
      const chunk2: FileChunk = {
        fileId: "multi-chunk-file",
        hash: "hash2",
        chunkNumber: 1,
        chunkSize: 524288,
        createdAt: new Date().toISOString(),
      };
      const chunk3: FileChunk = {
        fileId: "multi-chunk-file",
        hash: "hash3",
        chunkNumber: 2,
        chunkSize: 100000,
        createdAt: new Date().toISOString(),
      };

      await metadataService.saveChunk(chunk1);
      await metadataService.saveChunk(chunk3); // Save out of order
      await metadataService.saveChunk(chunk2);

      const chunks = await metadataService.getChunks("multi-chunk-file");
      expect(chunks.length).toBe(3);
      expect(chunks[0].chunkNumber).toBe(0);
      expect(chunks[1].chunkNumber).toBe(1);
      expect(chunks[2].chunkNumber).toBe(2);
    });
  });

  describe("update", () => {
    it("should update file metadata with partial data", async () => {
      // First save a file
      const file: FileMetadata = {
        id: "update-test-file",
        hash: "",
        status: "uploading",
        name: "original-name.png",
        fileSize: 1024,
        fileType: "image/png",
        compression: "deflate",
        owner: "anonymous",
        createdAt: new Date().toISOString(),
        chunksCount: 0,
      };

      await metadataService.save(file);

      // Update with partial data
      await metadataService.update("update-test-file", {
        status: "uploaded",
        chunksCount: 4,
      });

      // Verify update
      const updated = await metadataService.get("update-test-file");
      expect(updated).toBeDefined();
      expect(updated?.status).toBe("uploaded");
      expect(updated?.chunksCount).toBe(4);
      expect(updated?.name).toBe("original-name.png"); // Unchanged field
    });

    it("should handle update when file was previously uploaded", async () => {
      // Simulate re-uploading an existing file
      const fileId = "reupload-test-file";

      // First upload
      const file: FileMetadata = {
        id: fileId,
        hash: "old-hash",
        status: "uploaded",
        name: "test.png",
        fileSize: 1024,
        fileType: "image/png",
        compression: "deflate",
        owner: "anonymous",
        createdAt: new Date().toISOString(),
        chunksCount: 2,
      };

      await metadataService.save(file);

      // Re-upload - update status back to uploading
      await metadataService.update(fileId, {
        status: "uploading",
        chunksCount: 0,
      });

      const updated = await metadataService.get(fileId);
      expect(updated?.status).toBe("uploading");
      expect(updated?.chunksCount).toBe(0);
    });
  });
});

describe("FilesService HTTP Integration", () => {
  let app: Elysia;
  let baseUrl: string;
  const TEST_PORT = 13579;

  beforeAll(async () => {
    app = new Elysia().use(filesPlugin({ dbPath: "./data-test" }));

    // Wait for service to initialize
    await new Promise((resolve) => setTimeout(resolve, 500));

    app.listen(TEST_PORT);
    baseUrl = `http://localhost:${TEST_PORT}`;
  });

  afterAll(async () => {
    app.stop();
  });

  it("should save file metadata via HTTP", async () => {
    const file: FileMetadata = {
      id: "http-test-file-" + Date.now(),
      hash: "",
      status: "uploading",
      name: "test-http.png",
      fileSize: 2048,
      fileType: "image/png",
      compression: "deflate",
      owner: "anonymous",
      createdAt: new Date().toISOString(),
      chunksCount: 0,
    };

    const response = await fetch(`${baseUrl}/files/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ file }),
    });

    console.log("Response status:", response.status);
    const responseText = await response.text();
    console.log("Response body:", responseText);

    expect(response.ok).toBe(true);
  });

  it("should save file chunk via HTTP", async () => {
    const chunk: FileChunk = {
      fileId: "http-test-file-" + Date.now(),
      hash: "http-test-hash-123",
      chunkNumber: 0,
      chunkSize: 524288,
      createdAt: new Date().toISOString(),
    };

    const response = await fetch(`${baseUrl}/files/saveChunk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chunk }),
    });

    console.log("Chunk Response status:", response.status);
    const responseText = await response.text();
    console.log("Chunk Response body:", responseText);

    expect(response.ok).toBe(true);
  });
});
