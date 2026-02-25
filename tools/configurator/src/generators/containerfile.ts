import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";
import type { GeneratorContext, MicroserviceRef } from "../types";
import { getAllMicroservices } from "../resolver";

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

// --- Containerfile builder ---

class ContainerfileBuilder {
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

  // Paths from config
  private readonly spaCorePath: string;
  private readonly landingPath: string;
  private readonly storeWorkersPath = "front/libraries/store-workers";
  private readonly frontLandingsAbsPath: string;
  private readonly hasFrontLandingsSource: boolean;

  constructor(private ctx: GeneratorContext) {
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

    this.apkPackages = config.runtimeDeps?.apk ?? [];
    this.runtimePackages = config.runtimeDeps?.packages ?? {};
    this.frontLandingsAbsPath = resolve(this.buildContextRoot, "saas/public/front/front-landings");
    this.hasFrontLandingsSource = existsSync(this.frontLandingsAbsPath);

    // All microservices — single image contains everything
    this.allServices = getAllMicroservices(
      config,
      this.projectDir,
      this.parentDir,
    );
    this.plugins = this.allServices.map((svc) => resolvePlugin(svc, ctx));

    // All microfrontends
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

  // --- Header ---

  private header() {
    this.emit(
      "# Auto-generated Containerfile",
      `# Project: ${this.ctx.config.name}`,
      "",
    );
  }

  // --- Builder stage ---

  private builderStage() {
    this.emit(`FROM ${this.baseImage} AS builder`, "WORKDIR /build", "");

    this.copySources();
    this.installDeps();
    this.buildFrontend();
    this.prepareOutputDirs();
    this.buildPlugins();
    this.buildLandingPlugin();
    this.buildSpaPlugin();
    this.writeRuntimeMap();
    this.copyFrontendAssets();
    this.copyNativeLibs();
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

    if (dirExists(this.ctx, this.storeWorkersOwner, this.storeWorkersPath)) {
      this.emit(`RUN cd ${this.projectPath(this.storeWorkersOwner, this.storeWorkersPath)} && bun run src/tools/build.ts`);
    }
  }

  private prepareOutputDirs() {
    this.emit("");
    this.emit("RUN mkdir -p /build/out/app /build/out/plugins/chunks /build/out/dist/front \\");
    this.emit("      /build/out/dist/landing /build/out/dist/mf /build/out/front /build/out/lib");
  }

  private buildPlugins() {
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

  private writeRuntimeMap() {
    const toml = ["[services]"];
    for (const p of this.plugins) {
      toml.push(`"${p.key}" = "/app/plugins/chunks/${p.chunkPath}"`);
    }
    toml.push("", "[spa]", 'plugin = "/app/plugins/spa/plugin.js"');
    toml.push("", "[landing]", 'plugin = "/app/plugins/landing/plugin.js"');

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

    if (nativeSources.length === 0) return;

    const cmds = ["mkdir -p /build/out/plugins/bin-libs"];
    for (const { owner, path } of nativeSources) {
      cmds.push(`find ${this.projectPath(owner, path)} -type f -path '*/bin-libs/*-x86_64-musl.so' -exec cp {} /build/out/plugins/bin-libs/ \\;`);
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
      name: "runtime-app",
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

  // --- Runtime stage ---

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
    this.emit("COPY --from=builder /build/out/plugins ./plugins");
    this.emit("COPY --from=builder /build/out/dist ./dist");
    this.emit("COPY --from=builder /build/out/front ./front");
    this.emit("COPY --from=builder /build/out/lib ./lib");

    this.emit("");
    this.emit("RUN mkdir -p /app/data");

    this.emit("");
    this.emit("ENV NODE_ENV=production");
    this.emit("ENV PORT=3000");
    this.emit("ENV DATA_DIR=/app/data");
    this.emit("ENV PROJECT_DIR=/app");
    this.emit("ENV BIN_LIBS_PATH=/app/plugins/bin-libs");
    this.emit("ENV RUNTIME_MAP_PATH=/app/runtime-map.toml");
    this.emit("ENV LD_LIBRARY_PATH=/app/lib:/usr/lib");
    this.emit("ENV CONFIG_PATH=/app/config.json");

    this.emit("EXPOSE 3000");
    this.emit('CMD ["bun", "./server.js"]');
  }
}

// --- Public API ---

export async function generateContainerfiles(ctx: GeneratorContext): Promise<Map<string, string>> {
  const projectName = ctx.projectDir.split("/").pop()!;
  const result = new Map<string, string>();
  result.set(`${projectName}.Containerfile`, new ContainerfileBuilder(ctx).build());
  return result;
}
