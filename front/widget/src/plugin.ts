import { Elysia } from "elysia";
import { existsSync } from "fs";
import { resolve } from "path";

export interface AiChatWidgetPluginConfig {
  production?: boolean;
  route?: string;
  widgetRoot?: string;
  buildOnMissing?: boolean;
}

function normalizeRoute(route: string): string {
  return route.startsWith("/") ? route : `/${route}`;
}

async function fileExists(path: string): Promise<boolean> {
  return Bun.file(path).exists();
}

function resolveWidgetRoot(configRoot: string | undefined): string {
  const candidates = [
    configRoot,
    process.env.AI_CHAT_WIDGET_ROOT,
    process.env.PARENT_PROJECT_DIR
      ? resolve(process.env.PARENT_PROJECT_DIR, "front/widget")
      : undefined,
    process.env.PROJECT_DIR ? resolve(process.env.PROJECT_DIR, "front/widget") : undefined,
    resolve(import.meta.dir, ".."),
  ].filter((path): path is string => Boolean(path));

  return candidates.find((path) => existsSync(resolve(path, "dist"))) ?? candidates[0];
}

async function buildWidgetBundle(widgetRoot: string): Promise<void> {
  const proc = Bun.spawn({
    cmd: ["bun", "run", "build.ts"],
    cwd: widgetRoot,
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(
      [
        `[ai-chat-widget] build failed with exit code ${exitCode}`,
        stdout.trim(),
        stderr.trim(),
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }

  console.log("[ai-chat-widget] bundle built", { widgetRoot });
}

export function aiChatWidgetPlugin(config: AiChatWidgetPluginConfig = {}) {
  const isProd = config.production ?? process.env.NODE_ENV === "production";
  const route = normalizeRoute(config.route ?? "/ai-chat.iife.js");
  const widgetRoot = resolveWidgetRoot(config.widgetRoot);
  const bundlePath = resolve(widgetRoot, "dist", "ai-chat.iife.js");
  const brotliPath = `${bundlePath}.br`;
  const shouldBuildOnMissing = config.buildOnMissing ?? !isProd;
  let buildPromise: Promise<void> | null = null;

  async function ensureBundle(): Promise<void> {
    if (await fileExists(bundlePath)) {
      return;
    }

    if (!shouldBuildOnMissing) {
      throw new Error(`[ai-chat-widget] missing bundle: ${bundlePath}`);
    }

    buildPromise ??= buildWidgetBundle(widgetRoot).finally(() => {
      buildPromise = null;
    });
    await buildPromise;

    if (!(await fileExists(bundlePath))) {
      throw new Error(`[ai-chat-widget] build did not create: ${bundlePath}`);
    }
  }

  async function serveBundle(request: Request): Promise<Response> {
    await ensureBundle();

    const cacheControl = isProd
      ? "public, max-age=31536000, immutable"
      : "no-store";
    const acceptEncoding = request.headers.get("accept-encoding") ?? "";
    const canUseBrotli =
      isProd && acceptEncoding.includes("br") && (await fileExists(brotliPath));

    return new Response(Bun.file(canUseBrotli ? brotliPath : bundlePath), {
      headers: {
        "Content-Type": "application/javascript; charset=utf-8",
        "Cache-Control": cacheControl,
        Vary: "Accept-Encoding",
        ...(canUseBrotli ? { "Content-Encoding": "br" } : {}),
      },
    });
  }

  return new Elysia({ name: "ai-chat-widget" })
    .get(route, ({ request }) => serveBundle(request))
    .get("/dist/ai-chat.iife.js", ({ request }) => serveBundle(request));
}

export default aiChatWidgetPlugin;
