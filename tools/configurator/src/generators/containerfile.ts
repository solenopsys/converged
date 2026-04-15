import { existsSync, readdirSync, statSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { GeneratorContext, MicroserviceRef } from "../types";
import { getAllMicroservices } from "../resolver";
import {
  buildDeploymentPlan,
  RUNTIME_APP_PORT,
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

function resolveMicrofrontendRelDir(ownerAbsDir: string, microfrontend: string): string | null {
  const mfBaseRel = "front/microfrontends";
  const directRel = `${mfBaseRel}/${microfrontend}`;
  if (existsSync(resolve(ownerAbsDir, directRel))) return directRel;

  const mfBaseAbs = resolve(ownerAbsDir, mfBaseRel);
  if (!existsSync(mfBaseAbs)) return null;

  for (const group of readdirSync(mfBaseAbs, { withFileTypes: true })) {
    if (!group.isDirectory()) continue;
    const groupedRel = `${mfBaseRel}/${group.name}/${microfrontend}`;
    if (existsSync(resolve(ownerAbsDir, groupedRel))) return groupedRel;
  }

  return null;
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

type DynamicRole = "ui" | "ms" | "rt";

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
  private readonly deploymentPlan: ReturnType<typeof buildDeploymentPlan>;

  // Resolved owners
  private readonly spaCoreOwner: string;
  private readonly landingOwner: string;
  private readonly storeWorkersOwner: string;
  private readonly runtimeServerOwner: string;
  private readonly runtimePluginOwner: string;
  private readonly workflowsOwner: string;

  // Paths from config
  private readonly spaCorePath: string;
  private readonly landingPath: string;
  private readonly storeWorkersPath = "front/libraries/store-workers";
  private readonly pruneToolsScriptPath = "tools/scripts/prune-container-tools.ts";
  private readonly frontLandingsAbsPath: string;
  private readonly hasFrontLandingsSource: boolean;
  private readonly pruneToolsScriptOwner: string;

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
    this.deploymentPlan = buildDeploymentPlan(ctx);

    this.spaCorePath = config.spa.core || "front/front-core";
    this.landingPath = config.landing || "front/landing";

    this.spaCoreOwner = resolveOwnerDir(ctx, this.spaCorePath);
    this.landingOwner = resolveOwnerDir(ctx, this.landingPath);
    this.storeWorkersOwner = resolveOwnerDir(ctx, this.storeWorkersPath);
    this.runtimeServerOwner = resolveOwnerDir(ctx, "tools/container-runtime/server.entry.ts");
    this.runtimePluginOwner = resolveOwnerDir(ctx, "back/runtime/plugin.ts");
    this.workflowsOwner = resolveOwnerDir(ctx, "back/workflows/index.ts");
    this.pruneToolsScriptOwner = resolveOwnerDir(ctx, this.pruneToolsScriptPath);

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
    if (this.role === "ui") return UI_APP_PORT;
    if (this.role === "rt") return RUNTIME_APP_PORT;
    return SERVICES_APP_PORT;
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
    this.emit("ENV NODE_ENV=production", "");

    this.copySources();
    this.installDeps();

    if (this.role === "ui") {
      this.buildFrontend();
      this.prepareUiOutputDirs();
      this.buildLandingPlugin();
      this.buildSpaPlugin();
      this.copyFrontendAssets();
      this.writeUiRuntimeMap();
    } else if (this.role === "rt") {
      this.prepareMsOutputDirs();
      this.buildRuntimePlugin();
      this.buildWorkflows();
      this.copyNativeLibs();
      this.writeRtRuntimeMap();
    } else {
      this.prepareMsOutputDirs();
      this.buildServicePlugins();
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

    const pruneProjectTools =
      this.projectDir === "club-portal" &&
      dirExists(this.ctx, this.projectDir, "tools/integration");
    const hasPruneToolsScript = dirExists(
      this.ctx,
      this.pruneToolsScriptOwner,
      this.pruneToolsScriptPath,
    );

    if (pruneProjectTools && hasPruneToolsScript) {
      this.emit(
        `RUN bun ${this.projectPath(this.pruneToolsScriptOwner, this.pruneToolsScriptPath)} ${this.projectRoot(this.projectDir)}`,
      );
    }

    if (this.hasParent && this.parentDir) {
      this.emit(`RUN cd ${this.projectRoot(this.parentDir)} && bun install --frozen-lockfile`);
    }
    if (pruneProjectTools) {
      this.emit(`RUN cd ${this.projectRoot(this.projectDir)} && bun install --no-save`);
    } else {
      this.emit(`RUN cd ${this.projectRoot(this.projectDir)} && bun install --frozen-lockfile`);
    }
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

  private buildRuntimePlugin() {
    const runtimePluginPath = "back/runtime/plugin.ts";
    if (!dirExists(this.ctx, this.runtimePluginOwner, runtimePluginPath)) return;

    this.emit("");
    this.emit(`RUN bun build ${this.projectPath(this.runtimePluginOwner, runtimePluginPath)} \\`);
    this.emit("    --target bun --format esm --outdir /build/out/plugins/runtime \\");
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
      "",
      "[cache]",
      `url = "${this.deploymentPlan.cache.url}"`,
      `keyPrefix = "${this.deploymentPlan.cache.keyPrefix}"`,
      `ssrTtlSeconds = ${this.deploymentPlan.cache.ssrTtlSeconds}`,
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
    toml.push("");
    toml.push("[cache]");
    toml.push(`url = "${this.deploymentPlan.cache.url}"`);
    toml.push(`keyPrefix = "${this.deploymentPlan.cache.keyPrefix}"`);
    toml.push(`ssrTtlSeconds = ${this.deploymentPlan.cache.ssrTtlSeconds}`);

    this.emit("");
    this.emit("RUN cat > /build/out/app/runtime-map.toml <<'TOML'");
    this.emit(toml.join("\n"));
    this.emit("TOML");
  }

  private writeRtRuntimeMap() {
    const toml: string[] = [];

    if (dirExists(this.ctx, this.runtimePluginOwner, "back/runtime/plugin.ts")) {
      toml.push("[services]");
      toml.push('"runtime" = "/app/plugins/runtime/plugin.js"');
      toml.push("");
    }

    toml.push("[workflows]");
    if (dirExists(this.ctx, this.workflowsOwner, "back/workflows/index.ts")) {
      toml.push('plugin = "/app/plugins/workflows/index.js"');
    }
    toml.push("");
    toml.push("[cache]");
    toml.push(`url = "${this.deploymentPlan.cache.url}"`);
    toml.push(`keyPrefix = "${this.deploymentPlan.cache.keyPrefix}"`);
    toml.push(`ssrTtlSeconds = ${this.deploymentPlan.cache.ssrTtlSeconds}`);

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

    const mfLocaleCopySources: Array<{ owner: string; microfrontend: string }> = [];
    const mfLocaleOwners = [
      ...(this.hasParent && this.parentDir ? [this.parentDir] : []),
      this.projectDir,
    ];

    for (const owner of mfLocaleOwners) {
      const ownerAbsDir = resolveOwnerAbsDir(this.ctx, owner);
      if (!ownerAbsDir) continue;
      for (const microfrontend of this.allMfNames) {
        const mfRelDir = resolveMicrofrontendRelDir(ownerAbsDir, microfrontend);
        if (!mfRelDir) continue;
        const localeRelPath = `${mfRelDir}/locales`;
        if (!dirExists(this.ctx, owner, localeRelPath)) continue;
        mfLocaleCopySources.push({ owner, microfrontend });
      }
    }

    if (mfLocaleCopySources.length > 0) {
      copies.push("mkdir -p /build/out/front/microfrontends");
      for (const source of mfLocaleCopySources) {
        const ownerAbsDir = resolveOwnerAbsDir(this.ctx, source.owner);
        if (!ownerAbsDir) continue;
        const mfRelDir = resolveMicrofrontendRelDir(ownerAbsDir, source.microfrontend);
        if (!mfRelDir) continue;
        const localeRelPath = `${mfRelDir}/locales`;
        const targetDir = `/build/out/front/microfrontends/${source.microfrontend}/locales`;
        copies.push(`mkdir -p ${targetDir}`);
        copies.push(`cp -R ${this.projectPath(source.owner, `${localeRelPath}/.`)} ${targetDir}/`);
      }
    }

    this.emit("");
    this.emit(`RUN ${copies.join(" && \\\n    ")}`);
  }

  private copyNativeLibs() {
    const nativeSources = [
      ...(this.hasParent && this.parentDir ? [{ owner: this.parentDir, path: "back/native" }] : []),
      { owner: this.projectDir, path: "back/native" },
    ].filter(({ owner, path }) => dirExists(this.ctx, owner, path));
    const transportOverlaySources = [
      ...(this.hasParent && this.parentDir ? [{ owner: this.parentDir, path: "native/behemoth/bun-transport/bin-libs" }] : []),
      { owner: this.projectDir, path: "native/behemoth/bun-transport/bin-libs" },
    ].filter(({ owner, path }) => dirExists(this.ctx, owner, path));

    if (nativeSources.length === 0 && transportOverlaySources.length === 0) return;

    const cmds = ["mkdir -p /build/out/plugins/bin-libs"];
    for (const { owner, path } of nativeSources) {
      cmds.push(
        `find ${this.projectPath(owner, path)} -type f -path '*/bin-libs/*-x86_64-*.so' -exec cp -uf {} /build/out/plugins/bin-libs/ \\;`,
      );
    }
    for (const { owner, path } of transportOverlaySources) {
      cmds.push(
        `find ${this.projectPath(owner, path)} -type f -name 'libtransport-*-*.so' -exec cp -uf {} /build/out/plugins/bin-libs/ \\;`,
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
    } else if (this.role === "rt") {
      this.emit("COPY --from=builder /build/out/plugins/runtime ./plugins/runtime");
      this.emit("COPY --from=builder /build/out/plugins/workflows ./plugins/workflows");
      this.emit("COPY --from=builder /build/out/plugins/bin-libs ./plugins/bin-libs");
    } else {
      this.emit("COPY --from=builder /build/out/plugins/chunks ./plugins/chunks");
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

    if (this.role === "ms" || this.role === "rt") {
      this.emit("ENV BIN_LIBS_PATH=/app/plugins/bin-libs");
      this.emit("ENV LIBC_VARIANT=musl");
    }
    if (this.role === "ms") {
      this.emit("ENV LD_LIBRARY_PATH=/app/lib:/usr/lib");
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
    const projectOwner = ctx.projectDir.split("/").pop()!;
    const parentOwner = ctx.parentProjectDir?.split("/").pop();
    const owners = [
      projectOwner,
      ...(parentOwner ? [parentOwner] : []),
    ];

    let selectedPath = this.storageBinaryCandidates[0]!;
    let selectedOwner = resolveOwnerDir(ctx, selectedPath);
    let selectedMtimeMs = -1;

    for (const owner of owners) {
      const ownerAbsDir = resolveOwnerAbsDir(ctx, owner);
      if (!ownerAbsDir) continue;

      for (const candidate of this.storageBinaryCandidates) {
        const absPath = resolve(ownerAbsDir, candidate);
        if (!existsSync(absPath)) continue;
        const mtimeMs = statSync(absPath).mtimeMs;
        if (mtimeMs > selectedMtimeMs) {
          selectedMtimeMs = mtimeMs;
          selectedPath = candidate;
          selectedOwner = owner;
        }
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
  result.set(
    `${projectName}.rt.Containerfile`,
    new DynamicContainerfileBuilder(ctx, "rt").build(),
  );
  if (projectName === "converged-portal") {
    result.set(
      `${projectName}.storage.Containerfile`,
      new StorageContainerfileBuilder(ctx).build(),
    );
  }

  return result;
}
