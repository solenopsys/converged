import { basename } from "path";
import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";

// ──────────────────────────────────────────────────────────────────────────
// Generic, registry-agnostic build & release primitives.
//
// This module is part of the open-source core: it must NOT contain any
// production-specific values (registry ids, hosts, PVC paths, image sets).
// Everything concrete is provided by the caller — image names as params,
// registry via the REGISTRY env var. Closed orchestration (which images,
// which prod target) lives in club-portal/tools/commands/release.ts and
// imports the helpers exported here.
// ──────────────────────────────────────────────────────────────────────────

export function requiredEnv(name: string): string {
  const val = process.env[name]?.trim();
  if (!val) throw new Error(`${name} env var is required`);
  return val;
}

/** Run a command, streaming output, throw on non-zero exit. */
export async function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const proc = Bun.spawn([cmd, ...args], { stdout: "inherit", stderr: "inherit", cwd });
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (exit ${proc.exitCode}): ${cmd} ${args.join(" ")}`);
  }
}

/** Same as run() but never throws — used for idempotent ops (e.g. repo already exists). */
export async function runSoft(cmd: string, args: string[], cwd?: string): Promise<number> {
  const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe", cwd });
  await proc.exited;
  return proc.exitCode ?? 1;
}

export const awsRegion = (): string => process.env.AWS_REGION?.trim() || "us-east-1";

/** Public ECR registry base, e.g. public.ecr.aws/xxxxxxxx — provided by env. */
export const registry = (): string => requiredEnv("REGISTRY");

/** Strip "localhost/" prefix and ":tag" suffix to derive a bare repo name. */
export function repoName(localImage: string): string {
  return basename(localImage).replace(/:.*$/, "");
}

/** Authenticate podman against AWS public ECR. */
export async function ecrLogin(): Promise<void> {
  const proc = Bun.spawn(
    ["sh", "-c", `aws ecr-public get-login-password --region ${awsRegion()} | podman login --username AWS --password-stdin public.ecr.aws`],
    { stdout: "inherit", stderr: "inherit" },
  );
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error("ecr login failed");
}

/** Create public ECR repositories if missing (idempotent). */
export async function ensureRepos(names: string[]): Promise<void> {
  for (const name of names) {
    console.log(`ensure repo: ${name}`);
    await runSoft("aws", ["ecr-public", "create-repository", "--repository-name", name, "--region", awsRegion()]);
  }
}

/** Fully-qualified prod reference for a repo, e.g. public.ecr.aws/xxx/<name>:latest. */
export const prodRef = (remoteName: string): string => `${registry()}/${remoteName}:latest`;

/** Assign a tag to a local image (no push). */
export async function tagImage(localImage: string, target: string): Promise<void> {
  await run("podman", ["tag", localImage, target]);
}

/** Push an already-tagged image (layers present in the registry are skipped). */
export async function pushRef(ref: string): Promise<void> {
  await run("podman", ["push", ref]);
}

/** Tag a local image for $REGISTRY and push it. */
export async function pushImage(localImage: string, remoteName?: string): Promise<void> {
  const target = prodRef(remoteName ?? repoName(localImage));
  await tagImage(localImage, target);
  await pushRef(target);
}

export interface BuildSpec {
  tag: string;          // e.g. localhost/converged-portal-ui:latest
  containerfile: string;
  ignorefile: string;
  context: string;
  cwd?: string;
}

/** Build a single OCI image from a Containerfile via podman. */
export async function buildContainer(spec: BuildSpec): Promise<void> {
  await run(
    "podman",
    ["build", "--layers", "--ignorefile", spec.ignorefile, "-f", spec.containerfile, "-t", spec.tag, spec.context],
    spec.cwd,
  );
}

// ──────────────────────────────────────────────────────────────────────────
// Thin ad-hoc command surface (open-source). Concrete release flows live in
// the closed club-portal release processor.
// ──────────────────────────────────────────────────────────────────────────

const loginHandler: Handler = async () => {
  await ecrLogin();
};

const pushHandler: Handler = async (_client, _sep, param) => {
  const [local, remote] = (param ?? "").trim().split(/\s+/);
  if (!local) throw new Error("Usage: build push <local-image> [<remote-name>]");
  await pushImage(local, remote);
};

const reposHandler: Handler = async (_client, _sep, param) => {
  const names = (param ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (!names.length) throw new Error("Usage: build repos <name1,name2,...>");
  await ensureRepos(names);
};

class BuildProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["login", { handler: loginHandler, description: "Authenticate podman against public ECR (uses AWS_REGION)" }],
      ["push", { handler: pushHandler, description: "Tag & push a local image to $REGISTRY: build push <local> [remote]" }],
      ["repos", { handler: reposHandler, description: "Ensure ECR repos exist: build repos <name1,name2,...>" }],
    ]);
  }
}

export default () => new BuildProcessor(null);
