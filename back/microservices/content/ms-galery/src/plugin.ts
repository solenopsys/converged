import { createHttpBackend } from "nrpc";
import { isAbsolute, relative, resolve } from "node:path";
import { metadata } from "g-galery";
import serviceImpl from "./index";
import { StoresController } from "./stores";

type PluginOptions = {
  registerStartupTask?: (name: string, task: () => Promise<void>) => void;
  [key: string]: unknown;
};

const parseRange = (
  rangeHeader: string | null,
  size: number,
): { start: number; end: number } | "invalid" | null => {
  if (!rangeHeader) return null;

  const match = rangeHeader.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return "invalid";

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return "invalid";

  if (!rawStart) {
    const suffixLength = Number.parseInt(rawEnd, 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) return "invalid";
    const start = Math.max(size - suffixLength, 0);
    return { start, end: size - 1 };
  }

  const start = Number.parseInt(rawStart, 10);
  const end = rawEnd ? Number.parseInt(rawEnd, 10) : size - 1;

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    start >= size
  ) {
    return "invalid";
  }

  return { start, end: Math.min(end, size - 1) };
};

const resolveInside = (root: string, path: string): string | null => {
  const fullPath = resolve(root, path);
  const relPath = relative(root, fullPath);
  if (relPath.startsWith("..") || isAbsolute(relPath)) return null;
  return fullPath;
};

export default (options: PluginOptions = {}) =>
  (app: any) => {
    const backend = createHttpBackend({ metadata, serviceImpl });
    backend(options)(app);

    let stores: StoresController | undefined;
    let storesReady: Promise<void> | undefined;

    const ensureStores = async (): Promise<StoresController> => {
      if (!storesReady) {
        stores = new StoresController("galery-ms");
        storesReady = stores.init();
      }

      await storesReady;
      return stores as StoresController;
    };

    options.registerStartupTask?.("galery:file-route", async () => {
      await ensureStores();
    });

    const MIME: Record<string, string> = {
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      webp: "image/webp", gif: "image/gif", svg: "image/svg+xml",
      pdf: "application/pdf",
    };

    const dataDir = typeof options.dataDir === "string" ? options.dataDir : undefined;
    const staticDataRoot = dataDir
      ? resolve(dataDir, "galery-ms", "static", "data")
      : undefined;

    app.get("/galery/static/*", async ({ params, request, set }: any) => {
      const filePath = params["*"];
      if (!filePath) { set.status = 400; return "Bad request"; }
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      if (MIME[ext]) set.headers["Content-Type"] = MIME[ext];

      if (staticDataRoot) {
        const absPath = resolveInside(staticDataRoot, filePath);
        if (!absPath) { set.status = 400; return "Bad request"; }

        const file = Bun.file(absPath);
        if (await file.exists()) {
          const size = file.size;
          set.headers["Accept-Ranges"] = "bytes";

          const range = parseRange(request.headers.get("range"), size);
          if (range === "invalid") {
            set.status = 416;
            set.headers["Content-Range"] = `bytes */${size}`;
            set.headers["Content-Length"] = "0";
            return new Uint8Array();
          }

          if (range) {
            const endExclusive = range.end + 1;
            set.status = 206;
            set.headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
            set.headers["Content-Length"] = String(endExclusive - range.start);
            return file.slice(range.start, endExclusive);
          }

          set.headers["Content-Length"] = String(size);
          return file;
        }
      }

      const stores = await ensureStores();
      const data = await stores.static.get(filePath);
      if (!data) { set.status = 404; return "Not found"; }
      set.headers["Accept-Ranges"] = "bytes";

      const size = data.byteLength;
      const range = parseRange(request.headers.get("range"), size);
      if (range === "invalid") {
        set.status = 416;
        set.headers["Content-Range"] = `bytes */${size}`;
        set.headers["Content-Length"] = "0";
        return new Uint8Array();
      }

      if (range) {
        const chunk = data.subarray(range.start, range.end + 1);
        set.status = 206;
        set.headers["Content-Range"] = `bytes ${range.start}-${range.end}/${size}`;
        set.headers["Content-Length"] = String(chunk.byteLength);
        return chunk;
      }

      set.headers["Content-Length"] = String(size);
      return data;
    });

    app.put("/galery/static/*", async ({ params, request, set }: any) => {
      const filePath = params["*"];
      if (!filePath) { set.status = 400; return "Bad request"; }
      const stores = await ensureStores();
      const body = await request.arrayBuffer();
      await stores.static.put(filePath, new Uint8Array(body));
      set.status = 204;
    });

    app.get("/galery/file/:id", async ({ params, query, set }: any) => {
      const stores = await ensureStores();
      const image = await stores.images.get(params.id);
      if (!image) {
        set.status = 404;
        return "Not found";
      }

      const isThumb =
        query?.thumb === "1" || query?.thumb === "true" || query?.thumb === "yes";
      const filePath = isThumb ? image.thumbPath : image.filePath;
      const data = await stores.files.get(filePath);
      if (!data) {
        set.status = 404;
        return "Not found";
      }

      if (isThumb) {
        set.headers["Content-Type"] = "image/jpeg";
      } else if (image.mimeType) {
        set.headers["Content-Type"] = image.mimeType;
      }
      return data;
    });

    return app;
  };
