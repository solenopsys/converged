## files-state Refactor Notes

This is a dump of the plan/work-in-progress from the aborted refactor so it isn’t lost.

### Goals
- Replace the old compression/decompression worker pipeline with the new unified `store.worker.js`.
- Spawn one worker per file (for both upload and download) and wire its messages directly into Effector events.
- Remove chunk-level buffering in the client; store service interaction now lives inside the worker.
- Surface per-file progress (uploaded chunks/bytes, status) via Effector; keep existing metadata/save flows.
- Simplify download path: feed ordered chunk hashes + destination stream into the worker, observe progress & completion events.
- Extend `services` so worker instances inherit the same store options (base URL/auth/etc.) as the host app.
- Update store worker to emit download progress (current chunk out of total) for UI feedback.
- Clean up exports/tests/docs after the new module lands.

### Proposed Steps
1. **Services / configuration**
   - `services.setStoreService` should optionally accept `CreateStoreServiceOptions` and expose them for worker bootstrap.
2. **New transfer module**
   - Create `segments/transfers.ts` that:
     - Maintains `Map<UUID, Worker>` for upload/download.
     - Defines Effector events: `uploadWorkerRequested`, `uploadWorkerChunkStored`, `uploadWorkerProgress`, `uploadWorkerCompleted`, `uploadWorkerFailed`, plus download counterparts.
     - Spawns the worker from `../../store-workers/dist/store.worker.js`, forwards env/options, and pipes messages into events.
3. **files.ts / browser.ts cleanup**
   - Remove `$chunks`, retry queues, `chunkPrepared`, `chunkUploadStarted`, etc.
   - Track per-file fields: `uploadedChunks`, `uploadedBytes`, `status`.
   - When metadata is ready, trigger `uploadWorkerRequested({ fileId, file })`.
   - Map `uploadWorkerChunkStored` to `chunkMetadataSaveRequested`; update `$fileChunkHashes` and file progress.
4. **Download flow**
   - When the UI requests a download (metadata + hashes ready), call `downloadWorkerRequested` with ordered hashes and a `MessagePort`/`WritableStream`.
   - Listen for `downloadWorkerProgress` to update progress UI; handle completion/failure events.
5. **Store worker tweak**
   - Emit `{ type: DownloadWorkerEventType.Chunk, chunkNumber, totalChunks }` before/after piping each block so clients can render progress bars.
6. **Docs/tests**
   - Remove references to deleted modules; add new tests around the transfers module and worker interactions.

### Services changes that were drafted
- `services.ts` should keep both the classic `StoreService` client (used by server-side metadata functions) and the worker bootstrap options.  
- Suggested API:
  ```ts
  services.setStoreService(storeClient, { baseUrl: '/blocks/block', headers: {...} });
  services.setStoreWorkerOptions({ baseUrl: '/blocks/block', headers: {...} });
  // services.storeWorkerOptions exposes the last provided options (nullable).
  ```
- Workers read those options before posting `UploadStart`/`DownloadStart` so they hit the same backend endpoints as the host app.
- Update widget init (`src/shared/files-state/init.ts`) to pass the options once, so front-end and workers stay in sync.

Keep this file as a starting point when resuming the refactor. Any further notes can accumulate here.
