import { describe, expect, test } from "bun:test";
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const nrpcRoot = resolve(import.meta.dir, "..");
const generator = join(import.meta.dir, "generator.ts");
const zigGenerator = join(import.meta.dir, "zig-generator.ts");

describe("NRPC generator transport entrypoints", () => {
  test("selects WebSocket in browser bundles and cruller transport in native packages", async () => {
    const root = mkdtempSync(join(tmpdir(), "nrpc-generator-"));
    try {
      const typesDir = join(root, "types");
      const generatedDir = join(root, "generated");
      mkdirSync(typesDir, { recursive: true });
      writeFileSync(
        join(typesDir, "echo.ts"),
        `
export interface EchoService {
  ping(value: string): Promise<string>;
}
`,
      );

      const generated = Bun.spawnSync([
        "bun",
        "run",
        generator,
        join(typesDir, "echo.ts"),
        generatedDir,
        typesDir,
      ]);
      expect(generated.exitCode).toBe(0);

      const packageDir = join(generatedDir, "g-echo");
      const packageJson = JSON.parse(
        readFileSync(join(packageDir, "package.json"), "utf8"),
      );
      expect(packageJson.exports["."].browser).toBe("./src/browser.ts");
      expect(readFileSync(join(packageDir, "src/index.ts"), "utf8")).toContain(
        "createCrullerTransportClient",
      );
      expect(
        readFileSync(join(packageDir, "src/browser.ts"), "utf8"),
      ).toContain("createWebSocketClient");
      // The browser entrypoint is WebSocket-only on purpose: bootstrap goes
      // through the UI's own /auth routes, never nrpc-over-HTTP.
      expect(
        readFileSync(join(packageDir, "src/browser.ts"), "utf8"),
      ).not.toContain("createHttpClient");

      const nodeModules = join(root, "node_modules");
      mkdirSync(nodeModules);
      symlinkSync(nrpcRoot, join(nodeModules, "nrpc"), "dir");
      symlinkSync(packageDir, join(nodeModules, "g-echo"), "dir");
      const entry = join(root, "entry.ts");
      writeFileSync(
        entry,
        `import { createEchoServiceClient } from "g-echo"; void createEchoServiceClient;`,
      );

      const bundle = await Bun.build({
        entrypoints: [entry],
        root,
        target: "browser",
        bundle: true,
        write: false,
      });
      expect(bundle.success).toBe(true);
      const output = await Promise.all(
        bundle.outputs.map((file) => file.text()),
      );
      expect(output.join("\n")).not.toContain("bun:ffi");
      expect(output.join("\n")).not.toContain("cruller-transport-client");
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("NRPC generated method policy", () => {
  test("uses the default policy and ignores contract comments", () => {
    const root = mkdtempSync(join(tmpdir(), "nrpc-policy-"));
    try {
      const contract = join(root, "admin.ts");
      const output = join(root, "admin_nrpc.zig");
      const access = `@${"access"}`;
      const mode = `@${"mode"}`;
      const comments = ["/** ", `${access} internal `, `${mode} w */`, "/** ", `${access} user `, `${mode} r */`];
      writeFileSync(contract, `
export interface RuntimeAdminService {
  ${comments.slice(0, 3).join("")}
  reload(): Promise<void>;
  ${comments.slice(3).join("")}
  state(): Promise<unknown>;
}
`);
      const generated = Bun.spawnSync([
        "bun",
        "run",
        zigGenerator,
        contract,
        output,
      ]);
      expect(generated.exitCode).toBe(0);
      const code = readFileSync(output, "utf8");
      expect(code).toContain('.method = "reload", .level = .user, .mode = null');
      expect(code).toContain('.method = "state", .level = .user, .mode = null');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  test("does not derive policy from adjacent contract comments", () => {
    const root = mkdtempSync(join(tmpdir(), "nrpc-policy-scope-"));
    try {
      const contract = join(root, "admin.ts");
      const output = join(root, "admin_nrpc.zig");
      const comment = ["/** ", `@${"access"} public `, `@${"mode"} r */`].join("");
      writeFileSync(contract, `
export interface RuntimeAdminService {
  ${comment}
  health(): Promise<void>;
  mutate(): Promise<void>;
}
`);
      const generated = Bun.spawnSync(["bun", "run", zigGenerator, contract, output]);
      expect(generated.exitCode).toBe(0);
      const code = readFileSync(output, "utf8");
      expect(code).toContain('.method = "health", .level = .user, .mode = null');
      expect(code).toContain('.method = "mutate", .level = .user, .mode = null');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
