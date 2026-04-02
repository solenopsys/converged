import { createHttpBackend } from "nrpc";
import { metadata } from "g-galery";
import serviceImpl from "./index";
import { StoresController } from "./stores";

type PluginOptions = {
  registerStartupTask?: (name: string, task: () => Promise<void>) => void;
  [key: string]: unknown;
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

    app.get("/galery/static/*", async ({ params, set }: any) => {
      const filePath = params["*"];
      if (!filePath) { set.status = 400; return "Bad request"; }
      const stores = await ensureStores();
      const data = await stores.static.get(filePath);
      if (!data) { set.status = 404; return "Not found"; }
      const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
      if (MIME[ext]) set.headers["Content-Type"] = MIME[ext];
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
