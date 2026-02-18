#!/usr/bin/env bun

import { Elysia } from "elysia";
import process from "node:process";
import plugin from "./plugin";
import { OpenScadConvertorServiceImpl } from "./service";

const HOST = process.env.HOST ?? "0.0.0.0";
const PORT = Number(process.env.PORT ?? "3000");

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

const service = new OpenScadConvertorServiceImpl();

const app = new Elysia()
  .use(plugin())
  .get("/health", () => ({ ok: true }))
  .post("/convert", async ({ request }) => {
    const contentType = request.headers.get("content-type") ?? "";
    if (!contentType.includes("multipart/form-data")) {
      return json(
        {
          error: "Use multipart/form-data",
          hint: "POST /convert with field 'file' containing .step/.stp",
        },
        400,
      );
    }

    const form = await request.formData();
    const candidate = form.get("file") ?? form.get("step");
    if (!(candidate instanceof File)) {
      return json({ error: "Missing file field: file" }, 400);
    }

    try {
      const result = await service.convert({
        sourceName: candidate.name,
        sourceData: new Uint8Array(await candidate.arrayBuffer()),
      });

      return new Response(result.fileData, {
        status: 200,
        headers: {
          "content-type": result.contentType,
          "content-disposition": `attachment; filename=\"${result.fileName}\"`,
        },
      });
    } catch (error) {
      return json(
        {
          error: (error as Error).message,
        },
        500,
      );
    }
  });

app.listen({ hostname: HOST, port: PORT });

console.log(`openscadconvertor listening on http://${HOST}:${PORT}`);
