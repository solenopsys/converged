import { existsSync } from "fs";
import { resolve, sep } from "path";

function resolveWithExtensions(basePath: string): string | null {
  const candidates = [
    basePath,
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    `${basePath}.mjs`,
    `${basePath}.cjs`,
    `${basePath}.json`,
    resolve(basePath, "index.ts"),
    resolve(basePath, "index.tsx"),
    resolve(basePath, "index.js"),
    resolve(basePath, "index.jsx"),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveWorkspaceImport(specifier: string, root: string): string | null {
  const [base, ...restParts] = specifier.split("/");
  const rest = restParts.join("/");

  if (base.startsWith("g-")) {
    const baseDir = resolve(root, "tools/integration/generated", base, "src");
    const target = rest.length > 0 ? resolve(baseDir, rest) : resolve(baseDir, "index");
    return resolveWithExtensions(target);
  }

  if (base === "nrpc") {
    const baseDir = resolve(root, "tools/integration/nrpc/src");
    const target = rest.length > 0 ? resolve(baseDir, rest) : resolve(baseDir, "index");
    return resolveWithExtensions(target);
  }

  if (base === "assistant-state" || base === "files-state" || base === "md-tools") {
    const baseDir = resolve(root, "front/libraries", base, "src");
    const target = rest.length > 0 ? resolve(baseDir, rest) : resolve(baseDir, "index");
    return resolveWithExtensions(target);
  }

  return null;
}

function resolveIntegrationTypesImport(
  specifier: string,
  root: string,
): string | null {
  const marker = "integration/types/";
  const idx = specifier.indexOf(marker);
  if (idx === -1) return null;
  const rest = specifier.slice(idx + marker.length);
  if (!rest) return null;
  const baseDir = resolve(root, "tools/integration/types");
  const target = resolve(baseDir, rest);
  return resolveWithExtensions(target);
}

function resolveMicrofrontendAlias(
  specifier: string,
  importer: string,
  root: string,
): string | null {
  if (!specifier.startsWith("src/")) return null;
  const marker = `${sep}microfrontends${sep}`;
  const idx = importer.indexOf(marker);
  if (idx === -1) return null;
  const rest = importer.slice(idx + marker.length);
  const mfName = rest.split(sep)[0];
  if (!mfName) return null;
  const mfRoot = resolve(root, "front/microfrontends", mfName);
  const target = resolve(mfRoot, specifier);
  return resolveWithExtensions(target);
}

export function createWorkspaceResolverPlugin(
  projectRoot: string,
  parentProjectRoot?: string,
) {
  return {
    name: "workspace-resolver",
    setup(builder: any) {
      builder.onResolve(
        {
          filter: /^(g-|nrpc|assistant-state|files-state|md-tools)(\/|$)|^src\/|integration\/types\//,
        },
        (args: any) => {
          if (args.path.startsWith("src/")) {
            const resolved =
              resolveMicrofrontendAlias(args.path, args.importer, projectRoot) ??
              (parentProjectRoot
                ? resolveMicrofrontendAlias(args.path, args.importer, parentProjectRoot)
                : null);
            if (resolved) return { path: resolved };
            return;
          }

          if (args.path.includes("integration/types/")) {
            const resolved =
              resolveIntegrationTypesImport(args.path, projectRoot) ??
              (parentProjectRoot
                ? resolveIntegrationTypesImport(args.path, parentProjectRoot)
                : null);
            if (resolved) return { path: resolved };
            return;
          }

          const resolved =
            resolveWorkspaceImport(args.path, projectRoot) ??
            (parentProjectRoot ? resolveWorkspaceImport(args.path, parentProjectRoot) : null);
          if (resolved) return { path: resolved };
          return;
        },
      );
    },
  };
}
