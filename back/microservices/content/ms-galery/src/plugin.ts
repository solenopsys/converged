import { createHttpBackend } from "nrpc";
import { metadata } from "g-galery";
import serviceImpl from "./index";
import { StoresController } from "./stores";

export default (options: Record<string, unknown> = {}) =>
  (app: any) => {
    const backend = createHttpBackend({ metadata, serviceImpl });
    backend(options)(app);

    const stores = new StoresController("galery-ms");
    const initPromise = stores.init();

    app.get("/galery/file/:id", async ({ params, query, set }: any) => {
      await initPromise;
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
