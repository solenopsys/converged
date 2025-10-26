## files-state Refactor Plan

1. **Replace legacy worker pipeline**  
   - Remove `segments/streaming.ts` and `segments/store.ts`.  
   - Introduce a lightweight `segments/transfers.ts` that spins up one `store.worker.js` per file (upload + download).  
   - Ensure workers are resolved from `../../store-workers/dist/store.worker.js` and inherit env/options via `services`.

2. **Restructure upload events/state**  
   - Drop chunk-level stores/queues (`$chunks`, `chunkPrepared`, `uploadChunkRequested`, etc.).  
   - Track only per-file progress (`uploadedChunks`, `uploadedBytes`, status) updated from worker messages (`ChunkReady`, `Progress`, `FileUploaded`).  
   - Map worker `ChunkReady` events directly to metadata-save requests (`chunkMetadataSaveRequested`) without carrying raw `Uint8Array`.

3. **Simplify download flow**  
   - Remove decompression-specific stores/events; instead, when UI needs a download, request the worker with ordered chunk hashes and a `WritableStream`/`MessagePort`.  
   - Emit new effector events for download progress (`currentChunk/totalChunks`), completion, and failure.

4. **Services & configuration**  
   - Extend `services` to store optional `CreateStoreServiceOptions` so worker instances receive the same base URL/auth as `StoreService`.  
   - Update `init` code (e.g., in `aichat-widget`) to set worker options alongside service clients.

5. **Public API cleanup**  
   - Re-export the new transfers module from `src/index.ts`.  
   - Remove dead exports/tests referencing the old workers, update docs and types accordingly.  
   - Ensure `getFileProgress`, pause/resume/cancel hooks operate on the simplified per-file state.

6. **Store worker enhancement**  
   - Update `store.worker.ts` download branch to emit progress messages with the current chunk number/total chunks so UI can reflect download status.
