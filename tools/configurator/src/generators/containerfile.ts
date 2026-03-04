import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { GeneratorContext, MicroserviceRef } from "../types";
import { getAllMicroservices } from "../resolver";
import {
  SERVICES_APP_PORT,
  STORAGE_BIN_PATH,
  UI_APP_PORT,
} from "../topology";

// --- Path resolution helpers ---

function resolveOwnerDir(ctx: GeneratorContext, relativePath: string): string {
  const child = ctx.projectDir.split("/").pop()!;
  if (existsSync(resolve(ctx.projectDir, relativePath))) return child;
  if (ctx.parentProjectDir) {
    const parent = ctx.parentProjectDir.split("/").pop()!;
    if (existsSync(resolve(ctx.parentProjectDir, relativePath))) return parent;
  }
  return child;
}

function dirExists(ctx: GeneratorContext, ownerDirName: string, relPath: string): boolean {
  const projectDirName = ctx.projectDir.split("/").pop()!;
  const parentDirName = ctx.parentProjectDir?.split("/").pop();
  const absDir =
    ownerDirName === projectDirName ? ctx.projectDir
    : ownerDirName === parentDirName ? ctx.parentProjectDir
    : undefined;
  return absDir ? existsSync(resolve(absDir, relPath)) : false;
}

function resolveOwnerAbsDir(ctx: GeneratorContext, ownerDirName: string): string | undefined {
  const projectDirName = ctx.projectDir.split("/").pop()!;
  const parentDirName = ctx.parentProjectDir?.split("/").pop();
  if (ownerDirName === projectDirName) return ctx.projectDir;
  if (ownerDirName === parentDirName) return ctx.parentProjectDir;
  return undefined;
}

function shellEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

// --- Plugin resolution ---

const PLUGIN_CANDIDATES = ["src/plugin.ts", "src/plugin.tsx", "plugin.ts", "plugin.tsx"];

interface ResolvedPlugin {
  key: string;
  entry: string;
  chunkPath: string;
}

function resolvePlugin(svc: MicroserviceRef, ctx: GeneratorContext): ResolvedPlugin {
  const projectDirName = ctx.projectDir.split("/").pop()!;
  const parentDirName = ctx.parentProjectDir?.split("/").pop();
  const owner = svc.project || projectDirName;

  const ownerAbsDir =
    owner === projectDirName ? ctx.projectDir
    : owner === parentDirName ? ctx.parentProjectDir
    : undefined;

  const layouts = [
    `back/microservices/${svc.category}/ms-${svc.name}`,
    `back/microservices/ms-${svc.name}`,
  ];

  for (const layout of layouts) {
    for (const candidate of PLUGIN_CANDIDATES) {
      const rel = `${layout}/${candidate}`;
      if (ownerAbsDir && existsSync(resolve(ownerAbsDir, rel))) {
        const entry = `${owner}/${rel}`;
        return {
          key: `${svc.category}/${svc.name}`,
          entry,
          chunkPath: entry.replace(/\.tsx?$/, ".js"),
        };
      }
    }
  }

  throw new Error(
    `Plugin entry not found for "${svc.category}/${svc.name}" in ${owner}. ` +
    `Searched: ${layouts.flatMap(l => PLUGIN_CANDIDATES.map(c => `${l}/${c}`)).join(", ")}`,
  );
}

type DynamicRole = "ui" | "ms";

class DynamicContainerfileBuilder {
  private lines: string[] = [];
  private readonly projectDir: string;
  private readonly parentDir?: string;
  private readonly hasParent: boolean;
  private readonly buildContextRoot: string;
  private readonly workspaceRoot = "/build/clarity/projects";
  private readonly allServices: MicroserviceRef[];
  private readonly plugins: ResolvedPlugin[];
  private readonly allMfNames: string[];
  private readonly baseImage: string;
  private readonly apkPackages: string[];
  private readonly runtimePackages: Record<string, string>;

  // Resolved owners
  private readonly spaCoreOwner: string;
  private readonly landingOwner: string;
  private readonly storeWorkersOwner: string;
  private readonly runtimeServerOwner: string;
  private readonly workflowsOwner: string;

  // Paths from config
  private readonly spaCorePath: string;
  private readonly landingPath: string;
  private readonly storeWorkersPath = "front/libraries/store-workers";
  private readonly frontLandingsAbsPath: string;
  private readonly hasFrontLandingsSource: boolean;

  constructor(
    private ctx: GeneratorContext,
    private role: DynamicRole,
  ) {
    const { config } = ctx;

    this.projectDir = ctx.projectDir.split("/").pop()!;
    this.parentDir = ctx.parentProjectDir?.split("/").pop();
    this.hasParent = Boolean(this.parentDir);
    this.buildContextRoot = resolve(ctx.projectDir, "../../..");

    this.baseImage = config.baseImage!;
    if (!this.baseImage) throw new Error(`"baseImage" is required in config`);

    this.spaCorePath = config.spa.core || "front/front-core";
    this.landingPath = config.landing || "front/landing";

    this.spaCoreOwner = resolveOwnerDir(ctx, this.spaCorePath);
    this.landingOwner = resolveOwnerDir(ctx, this.landingPath);
    this.storeWorkersOwner = resolveOwnerDir(ctx, this.storeWorkersPath);
    this.runtimeServerOwner = resolveOwnerDir(ctx, "tools/container-runtime/server.entry.ts");
    this.workflowsOwner = resolveOwnerDir(ctx, "back/workflows/index.ts");

    this.apkPackages = config.runtimeDeps?.apk ?? [];
    this.runtimePackages = config.runtimeDeps?.packages ?? {};
    this.frontLandingsAbsPath = resolve(this.buildContextRoot, "saas/public/front/front-landings");
    this.hasFrontLandingsSource = existsSync(this.frontLandingsAbsPath);

    this.allServices = getAllMicroservices(
      config,
      this.projectDir,
      this.parentDir,
    );
    this.plugins = this.role === "ms"
      ? this.allServices.map((svc) => resolvePlugin(svc, ctx))
      : [];

    this.allMfNames = config.spa.microfrontends.map(
      (name) => name.startsWith("mf-") ? name : `mf-${name}`,
    );
  }

  build(): string {
    this.header();
    this.builderStage();
    this.runtimeStage();
    return this.lines.join("\n");
  }

  private emit(...lines: string[]) { this.lines.push(...lines); }

  private toContextPath(absPath: string): string {
    return relative(this.buildContextRoot, absPath).replace(/\\/g, "/");
  }

  private projectRoot(owner: string): string {
    return `${this.workspaceRoot}/${owner}`;
  }

  private projectPath(owner: string, relPath: string): string {
    return `${this.projectRoot(owner)}/${relPath}`;
  }

  private runtimePort(): number {
    return this.role === "ui" ? UI_APP_PORT : SERVICES_APP_PORT;
  }

  private header() {
    this.emit(
      "# Auto-generated Containerfile",
      `# Project: ${this.ctx.config.name}`,
      `# Role: ${this.role}`,
      "",
    );
  }

  private builderStage() {
    this.emit(`FROM ${this.baseImage} AS builder`, "WORKDIR /build", "");

    this.copySources();
    this.installDeps();

    if (this.role === "ui") {
      this.buildFrontend();
      this.prepareUiOutputDirs();
      this.buildLandingPlugin();
      this.buildSpaPlugin();
      this.copyFrontendAssets();
      this.writeUiRuntimeMap();
    } else {
      this.prepareMsOutputDirs();
      this.buildServicePlugins();
      this.buildWorkflows();
      this.copyNativeLibs();
      this.writeMsRuntimeMap();
    }

    this.buildRuntimeServer();
    this.writeRuntimeConfig();
  }

  private copySources() {
    this.emit(
      `COPY ${this.toContextPath(this.ctx.projectDir)} ./clarity/projects/${this.projectDir}`,
    );
    if (this.hasParent && this.parentDir) {
      this.emit(
        `COPY ${this.toContextPath(this.ctx.parentProjectDir!)} ./clarity/projects/${this.parentDir}`,
      );
    }
    if (this.hasFrontLandingsSource) {
      this.emit(
        `COPY ${this.toContextPath(this.frontLandingsAbsPath)} ./saas/public/front/front-landings`,
      );
    }
  }

  private installDeps() {
    this.emit("");
    if (this.hasParent && this.parentDir) {
      this.emit(`RUN cd ${this.projectRoot(this.parentDir)} && bun install --frozen-lockfile`);
    }
    this.emit(`RUN cd ${this.projectRoot(this.projectDir)} && bun install --frozen-lockfile`);
  }

  private prepareUiOutputDirs() {
    this.emit("");
    this.emit("RUN mkdir -p /build/out/app /build/out/plugins/spa /build/out/plugins/landing \\");
    this.emit("      /build/out/dist/front /build/out/dist/landing /build/out/dist/mf /build/out/front");
  }

  private prepareMsOutputDirs() {
    this.emit("");
    this.emit("RUN mkdir -p /build/out/app /build/out/plugins/chunks /build/out/plugins/workflows \\");
    this.emit("      /build/out/plugins/bin-libs /build/out/lib");
  }

  private buildFrontend() {
    this.emit("");
    this.emit(`RUN cd ${this.projectPath(this.spaCoreOwner, this.spaCorePath)} && NODE_ENV=production bun run bld`);
    this.emit(`RUN cd ${this.projectPath(this.landingOwner, this.landingPath)} && bun run build:client`);

    if (this.allMfNames.length > 0) {
      this.emit(`RUN cd ${this.projectPath(this.landingOwner, this.landingPath)} && MICROFRONTENDS=$'${shellEscape(this.allMfNames.join(","))}' bun run build:mf`);
    } else {
      this.emit(`RUN cd ${this.projectPath(this.landingOwner, this.landingPath)} && bun run build:mf`);
    }

    this.emit(`RUN cd ${this.projectPath(this.landingOwner, this.landingPath)} && bun -e "const { buildStyles } = await import('./src/ssr/styles.ts'); const css = await buildStyles(); await Bun.write('./dist/styles.css', css);"`);
    this.emit(`RUN cd ${this.projectPath(this.landingOwner, this.landingPath)} && bun -e "import { existsSync, mkdirSync, writeFileSync } from 'node:fs'; import { resolve } from 'node:path'; const publicDir = resolve(process.cwd(), 'public'); mkdirSync(publicDir, { recursive: true }); const manifestPath = resolve(publicDir, 'manifest.json'); if (!existsSync(manifestPath)) { const manifest = { name: '4IR App', short_name: '4IR', description: '4IR application', start_url: '/', scope: '/', display: 'standalone', background_color: '#ffffff', theme_color: '#000000', icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }] }; writeFileSync(manifestPath, JSON.stringify(manifest, null, 2)); } const swPath = resolve(publicDir, 'sw.js'); if (!existsSync(swPath)) { writeFileSync(swPath, \\\"self.addEventListener('install', () => self.skipWaiting());\\\\nself.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));\\\\n\\\"); }"`);

    if (dirExists(this.ctx, this.storeWorkersOwner, this.storeWorkersPath)) {
      this.emit(`RUN cd ${this.projectPath(this.storeWorkersOwner, this.storeWorkersPath)} && bun run src/tools/build.ts`);
    }
  }

  private buildServicePlugins() {
    if (this.plugins.length === 0) return;

    const entries = this.plugins.map((p) => `./${p.entry}`).join(" \\\n    ");
    this.emit("");
    this.emit(`RUN cd ${this.workspaceRoot} && bun build \\`);
    this.emit(`    ${entries} \\`);
    this.emit("    --target bun --format esm --splitting --outdir /build/out/plugins/chunks --minify");
  }

  private buildLandingPlugin() {
    this.emit("");
    this.emit(`RUN bun build ${this.projectPath(this.landingOwner, `${this.landingPath}/src/plugin.tsx`)} \\`);
    this.emit("    --target bun --format esm --outdir /build/out/plugins/landing \\");
    this.emit("    --minify --external lightningcss --no-splitting");
  }

  private buildSpaPlugin() {
    const spaPluginOwner = resolveOwnerDir(this.ctx, "front/spa/src/plugin.ts");
    const spaPluginEntry = this.projectPath(spaPluginOwner, "front/spa/src/plugin.ts");
    this.emit("");
    this.emit(`RUN bun build ${spaPluginEntry} \\`);
    this.emit("    --target bun --format esm --outdir /build/out/plugins/spa \\");
    this.emit("    --minify --no-splitting");
  }

  private buildWorkflows() {
    const entry = this.projectPath(this.workflowsOwner, "back/workflows/index.ts");
    if (!dirExists(this.ctx, this.workflowsOwner, "back/workflows/index.ts")) return;
    this.emit("");
    this.emit(`RUN bun build ${entry} \\`);
    this.emit("    --target bun --format esm --outdir /build/out/plugins/workflows \\");
    this.emit("    --minify --no-splitting");
  }

  private writeUiRuntimeMap() {
    const toml = [
      "[services]",
      "",
      "[spa]",
      'plugin = "/app/plugins/spa/plugin.js"',
      "",
      "[landing]",
      'plugin = "/app/plugins/landing/plugin.js"',
    ];

    this.emit("");
    this.emit("RUN cat > /build/out/app/runtime-map.toml <<'TOML'");
    this.emit(toml.join("\n"));
    this.emit("TOML");
  }

  private writeMsRuntimeMap() {
    const toml = ["[services]"];
    for (const p of this.plugins) {
      toml.push(`"${p.key}" = "/app/plugins/chunks/${p.chunkPath}"`);
    }
    if (dirExists(this.ctx, this.workflowsOwner, "back/workflows/index.ts")) {
      toml.push("", "[workflows]", 'plugin = "/app/plugins/workflows/index.js"');
    }

    this.emit("");
    this.emit("RUN cat > /build/out/app/runtime-map.toml <<'TOML'");
    this.emit(toml.join("\n"));
    this.emit("TOML");
  }

  private copyFrontendAssets() {
    const copies: string[] = [];

    copies.push(`cp -R ${this.projectPath(this.spaCoreOwner, `${this.spaCorePath}/dist/.`)} /build/out/dist/front/`);
    copies.push(`cp -R ${this.projectPath(this.landingOwner, `${this.landingPath}/dist/.`)} /build/out/dist/landing/`);
    copies.push(`cp -R ${this.projectPath(this.landingOwner, "dist/mf/.")} /build/out/dist/mf/`);

    if (dirExists(this.ctx, this.spaCoreOwner, `${this.spaCorePath}/locales`)) {
      copies.push("mkdir -p /build/out/front/front-core/locales");
      copies.push(`cp -R ${this.projectPath(this.spaCoreOwner, `${this.spaCorePath}/locales/.`)} /build/out/front/front-core/locales/`);
    }
    if (dirExists(this.ctx, this.landingOwner, `${this.landingPath}/public`)) {
      copies.push("mkdir -p /build/out/front/landing/public");
      copies.push(`cp -R ${this.projectPath(this.landingOwner, `${this.landingPath}/public/.`)} /build/out/front/landing/public/`);
    }
    if (dirExists(this.ctx, this.storeWorkersOwner, this.storeWorkersPath)) {
      copies.push("mkdir -p /build/out/front/libraries/store-workers/dist");
      copies.push(`cp -R ${this.projectPath(this.storeWorkersOwner, `${this.storeWorkersPath}/dist/.`)} /build/out/front/libraries/store-workers/dist/`);
    }

    this.emit("");
    this.emit(`RUN ${copies.join(" && \\\n    ")}`);
  }

  private copyNativeLibs() {
    const nativeSources = [
      { owner: this.projectDir, path: "back/native" },
      ...(this.hasParent && this.parentDir ? [{ owner: this.parentDir, path: "back/native" }] : []),
    ].filter(({ owner, path }) => dirExists(this.ctx, owner, path));
    const transportOverlaySources = [
      { owner: this.projectDir, path: "native/wrapers/transport/zig-out/lib" },
      ...(this.hasParent && this.parentDir ? [{ owner: this.parentDir, path: "native/wrapers/transport/zig-out/lib" }] : []),
    ].filter(({ owner, path }) => dirExists(this.ctx, owner, path));

    if (nativeSources.length === 0 && transportOverlaySources.length === 0) return;

    const cmds = ["mkdir -p /build/out/plugins/bin-libs"];
    for (const { owner, path } of nativeSources) {
      cmds.push(
        `find ${this.projectPath(owner, path)} -type f -path '*/bin-libs/*-x86_64-*.so' -exec cp {} /build/out/plugins/bin-libs/ \\;`,
      );
    }
    for (const { owner, path } of transportOverlaySources) {
      cmds.push(
        `find ${this.projectPath(owner, path)} -type f -name 'libtransport-*-*.so' -exec cp -f {} /build/out/plugins/bin-libs/ \\;`,
      );
    }
    this.emit("");
    this.emit(`RUN ${cmds.join(" && \\\n    ")}`);
  }

  private buildRuntimeServer() {
    this.emit("");
    this.emit(`RUN bun build ${this.projectPath(this.runtimeServerOwner, "tools/container-runtime/server.entry.ts")} \\`);
    this.emit("    --target bun --format esm --outfile /build/out/app/server.js --minify");
  }

  private writeRuntimeConfig() {
    const hasRuntimePkgs = Object.keys(this.runtimePackages).length > 0;

    const pkgJson = JSON.stringify({
      name: `runtime-${this.role}`,
      private: true,
      type: "module",
      ...(hasRuntimePkgs ? { dependencies: this.runtimePackages } : {}),
    }, null, 2);

    this.emit("");
    this.emit("RUN cat > /build/out/app/package.json <<'EOF'");
    this.emit(pkgJson);
    this.emit("EOF");
    this.emit("");
    this.emit("RUN cat > /build/out/app/bunfig.toml <<'EOF'");
    this.emit("[run]");
    this.emit("smol = true");
    this.emit("EOF");
  }

  private runtimeStage() {
    const hasRuntimePkgs = Object.keys(this.runtimePackages).length > 0;

    this.emit("");
    this.emit(`FROM ${this.baseImage} AS runtime`);
    this.emit("WORKDIR /app");

    if (this.apkPackages.length > 0) {
      this.emit(`RUN apk add --no-cache ${this.apkPackages.join(" ")}`);
    }

    this.emit("");
    this.emit("COPY --from=builder /build/out/app/package.json ./package.json");
    if (hasRuntimePkgs) {
      this.emit("RUN bun install --production");
    }

    this.emit("");
    this.emit("COPY --from=builder /build/out/app/server.js ./server.js");
    this.emit("COPY --from=builder /build/out/app/bunfig.toml ./bunfig.toml");
    this.emit("COPY --from=builder /build/out/app/runtime-map.toml ./runtime-map.toml");

    if (this.role === "ui") {
      this.emit("COPY --from=builder /build/out/plugins/spa ./plugins/spa");
      this.emit("COPY --from=builder /build/out/plugins/landing ./plugins/landing");
      this.emit("COPY --from=builder /build/out/dist ./dist");
      this.emit("COPY --from=builder /build/out/front ./front");
    } else {
      this.emit("COPY --from=builder /build/out/plugins/chunks ./plugins/chunks");
      this.emit("COPY --from=builder /build/out/plugins/workflows ./plugins/workflows");
      this.emit("COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs");
      this.emit("COPY --from=builder /build/out/lib ./lib");
    }

    this.emit("");
    this.emit("RUN mkdir -p /app/data /app/plugins && chown -R 1000:1000 /app");

    this.emit("");
    this.emit("ENV NODE_ENV=production");
    this.emit(`ENV PORT=${this.runtimePort()}`);
    this.emit("ENV DATA_DIR=/app/data");
    this.emit("ENV PROJECT_DIR=/app");
    this.emit("ENV RUNTIME_MAP_PATH=/app/runtime-map.toml");
    this.emit("ENV CONFIG_PATH=/app/config.json");

    if (this.role === "ms") {
      this.emit("ENV BIN_LIBS_PATH=/app/plugins/bin-libs");
      this.emit("ENV LD_LIBRARY_PATH=/app/lib:/usr/lib");
      this.emit("ENV LIBC_VARIANT=musl");
    }

    this.emit("");
    this.emit("RUN adduser -D -u 1000 default || true");
    this.emit("USER 1000");

    this.emit(`EXPOSE ${this.runtimePort()}`);
    this.emit('CMD ["bun", "./server.js"]');
  }
}

class StorageContainerfileBuilder {
  private lines: string[] = [];
  private readonly buildContextRoot: string;
  private readonly storageBinaryCandidates = [
    "native/storage/zig-out/bin/storage",
    "native/storage/zig-out/bin/storage-x86_64-musl",
    "native/storage/zig-out/bin/storage-x86_64-gnu",
    "native/storage/zig-out/bin/storage-aarch64-musl",
    "native/storage/zig-out/bin/storage-aarch64-gnu",
  ];
  private readonly storageBinaryPath: string;
  private readonly storageBinaryOwner: string;

  constructor(private ctx: GeneratorContext) {
    this.buildContextRoot = resolve(ctx.projectDir, "../../..");
    let selectedPath = this.storageBinaryCandidates[0]!;
    let selectedOwner = resolveOwnerDir(ctx, selectedPath);

    for (const candidate of this.storageBinaryCandidates) {
      const owner = resolveOwnerDir(ctx, candidate);
      const ownerAbsDir = resolveOwnerAbsDir(ctx, owner);
      if (ownerAbsDir && existsSync(resolve(ownerAbsDir, candidate))) {
        selectedPath = candidate;
        selectedOwner = owner;
        break;
      }
    }

    this.storageBinaryPath = selectedPath;
    this.storageBinaryOwner = selectedOwner;
  }

  build(): string {
    this.header();
    this.runtimeStage();
    return this.lines.join("\n");
  }

  private emit(...lines: string[]) { this.lines.push(...lines); }

  private toContextPath(absPath: string): string {
    return relative(this.buildContextRoot, absPath).replace(/\\/g, "/");
  }

  private storageBinaryAbsPath(): string {
    const ownerAbsDir = resolveOwnerAbsDir(this.ctx, this.storageBinaryOwner);
    if (!ownerAbsDir) {
      throw new Error(`Unable to resolve storage binary owner: ${this.storageBinaryOwner}`);
    }
    const absPath = resolve(ownerAbsDir, this.storageBinaryPath);
    if (!existsSync(absPath)) {
      throw new Error(
        `Storage binary not found. Tried: ${this.storageBinaryCandidates.join(", ")}. ` +
        `Run "zig build -Doptimize=ReleaseFast" or "zig build -Dall -Doptimize=ReleaseFast" in native/storage first.`,
      );
    }
    return absPath;
  }

  private header() {
    this.emit(
      "# Auto-generated Containerfile",
      `# Project: ${this.ctx.config.name}`,
      "# Role: storage",
      "",
    );
  }

  private runtimeStage() {
    const binaryAbsPath = this.storageBinaryAbsPath();

    this.emit("FROM alpine:3.20 AS runtime");
    this.emit("WORKDIR /app");
    this.emit("");
    this.emit(`COPY ${this.toContextPath(binaryAbsPath)} ${STORAGE_BIN_PATH}`);
    this.emit(`RUN chmod +x ${STORAGE_BIN_PATH} && mkdir -p /app/data /app/socket && chown -R 1000:1000 /app`);
    this.emit("RUN adduser -D -u 1000 default || true");
    this.emit("USER 1000");
    this.emit("");
    this.emit('CMD ["/app/storage", "start", "--data-dir", "/app/data", "--socket", "/app/socket/storage.sock"]');
  }
}

export async function generateContainerfiles(ctx: GeneratorContext): Promise<Map<string, string>> {
  const projectName = ctx.projectDir.split("/").pop()!;
  const result = new Map<string, string>();

  result.set(
    `${projectName}.ui.Containerfile`,
    new DynamicContainerfileBuilder(ctx, "ui").build(),
  );
  result.set(
    `${projectName}.ms.Containerfile`,
    new DynamicContainerfileBuilder(ctx, "ms").build(),
  );
  if (projectName === "converged-portal") {
    result.set(
      `${projectName}.storage.Containerfile`,
      new StorageContainerfileBuilder(ctx).build(),
    );
  }

  return result;
}
