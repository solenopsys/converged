import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-dumps";
import DumpsServiceImpl from "./service";

const MAX_SEGMENT = 1024 * 1024; // 1 MB

const baseBackend = createHttpBackend({
  metadata,
  serviceImpl: DumpsServiceImpl,
});

export default (pluginOptions: { socketPath?: string } = {}) => (app: Elysia) => {
  baseBackend(pluginOptions)(app);

  const service = new DumpsServiceImpl(pluginOptions);

  // Download dump file with HTTP Range support (segments ≤ 1MB)
  app.get("/dumps/download/:fileName", async ({ params, set, headers }) => {
    let totalSize: number;
    try {
      totalSize = await service.getDumpSize(params.fileName);
    } catch {
      set.status = 404;
      return { error: "Dump not found" };
    }

    const rangeHeader = headers["range"];

    if (!rangeHeader) {
      // No Range — stream the whole file in 1MB segments
      set.headers["Content-Type"] = "application/octet-stream";
      set.headers["Content-Disposition"] = `attachment; filename="${params.fileName}"`;
      set.headers["Content-Length"] = String(totalSize);
      set.headers["Accept-Ranges"] = "bytes";

      return new ReadableStream({
        start(controller) {
          let offset = 0n;
          const read = () => {
            if (offset >= BigInt(totalSize)) {
              controller.close();
              return;
            }
            const remaining = BigInt(totalSize) - offset;
            const chunkSize = Number(remaining < BigInt(MAX_SEGMENT) ? remaining : BigInt(MAX_SEGMENT));
            try {
              const chunk = service.readDumpSegment(params.fileName, offset, chunkSize);
              controller.enqueue(chunk);
              offset += BigInt(chunk.length);
              read();
            } catch (e) {
              controller.error(e);
            }
          };
          read();
        },
      });
    }

    // Parse Range header: bytes=start-end
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      set.status = 416;
      set.headers["Content-Range"] = `bytes */${totalSize}`;
      return { error: "Invalid Range" };
    }

    const start = parseInt(match[1], 10);
    const end = match[2] ? Math.min(parseInt(match[2], 10), totalSize - 1) : Math.min(start + MAX_SEGMENT - 1, totalSize - 1);

    if (start >= totalSize || start > end) {
      set.status = 416;
      set.headers["Content-Range"] = `bytes */${totalSize}`;
      return { error: "Range not satisfiable" };
    }

    const length = end - start + 1;
    const data = service.readDumpSegment(params.fileName, BigInt(start), length);

    set.status = 206;
    set.headers["Content-Type"] = "application/octet-stream";
    set.headers["Content-Range"] = `bytes ${start}-${start + data.length - 1}/${totalSize}`;
    set.headers["Content-Length"] = String(data.length);
    set.headers["Accept-Ranges"] = "bytes";

    return data;
  });

  return app;
};
