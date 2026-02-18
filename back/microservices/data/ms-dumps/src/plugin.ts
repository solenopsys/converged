import { Elysia } from "elysia";
import { createHttpBackend } from "nrpc";
import { metadata } from "g-dumps";
import DumpsServiceImpl, { resolveDumpsConfig, resolveDumpFilePath } from "./service";

const baseBackend = createHttpBackend({
  metadata,
  serviceImpl: DumpsServiceImpl,
});

export default (pluginOptions: { dbPath?: string } = {}) => (app: Elysia) => {
  // Регистрируем стандартные nrpc эндпоинты
  baseBackend(pluginOptions)(app);

  // Дополнительный эндпоинт для скачивания файлов
  const { dumpsDir } = resolveDumpsConfig(pluginOptions);

  app.get("/dumps/download/:fileName", async ({ params, set }) => {
    try {
      const filePath = resolveDumpFilePath(dumpsDir, params.fileName);
      const file = Bun.file(filePath);
      if (!(await file.exists())) {
        set.status = 404;
        return { error: "Dump not found" };
      }
      set.headers["Content-Type"] = "application/gzip";
      set.headers["Content-Disposition"] = `attachment; filename="${params.fileName}"`;
      return file;
    } catch (error) {
      set.status = 400;
      return { error: "Invalid file name" };
    }
  });

  return app;
};
