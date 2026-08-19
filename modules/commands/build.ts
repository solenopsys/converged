import { basename } from "path";
import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";

// ──────────────────────────────────────────────────────────────────────────
// Generic, registry-agnostic build & release primitives.
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


export async function run(cmd: string, args: string[], cwd?: string): Promise<void> {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const proc = Bun.spawn([cmd, ...args], { stdout: "inherit", stderr: "inherit", cwd });
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(`Command failed (exit ${proc.exitCode}): ${cmd} ${args.join(" ")}`);
  }
}


export async function runSoft(cmd: string, args: string[], cwd?: string): Promise<number> {
  const proc = Bun.spawn([cmd, ...args], { stdout: "pipe", stderr: "pipe", cwd });
  await proc.exited;
  return proc.exitCode ?? 1;
}

export const awsRegion = (): string => process.env.AWS_REGION?.trim() || "us-east-1";


export const registry = (): string => requiredEnv("REGISTRY");


export function repoName(localImage: string): string {
  return basename(localImage).replace(/:.*$/, "");
}


export async function ecrLogin(): Promise<void> {
  const proc = Bun.spawn(
    ["sh", "-c", `aws ecr-public get-login-password --region ${awsRegion()} | podman login --username AWS --password-stdin public.ecr.aws`],
    { stdout: "inherit", stderr: "inherit" },
  );
  await proc.exited;
  if (proc.exitCode !== 0) throw new Error("ecr login failed");
}


export async function ensureRepos(names: string[]): Promise<void> {
  for (const name of names) {
    console.log(`ensure repo: ${name}`);
    await runSoft("aws", ["ecr-public", "create-repository", "--repository-name", name, "--region", awsRegion()]);
  }
}


export const prodRef = (remoteName: string): string => `${registry()}/${remoteName}:latest`;


export async function tagImage(localImage: string, target: string): Promise<void> {
  await run("podman", ["tag", localImage, target]);
}


export async function pushRef(ref: string): Promise<void> {
  await run("podman", ["push", ref]);
}


export async function pushImage(localImage: string, remoteName?: string): Promise<void> {
  const target = prodRef(remoteName ?? repoName(localImage));
  await tagImage(localImage, target);
  await pushRef(target);
}

function formatBytes(bytes: number): string {
  const units = ["B", "KiB", "MiB", "GiB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

export async function printImageSize(image: string): Promise<void> {
  const proc = Bun.spawn(
    ["podman", "image", "inspect", "--format", "{{.Size}}", image],
    { stdout: "pipe", stderr: "inherit" },
  );
  const output = await new Response(proc.stdout).text();
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error(`Unable to inspect built image '${image}'`);
  }
  const bytes = Number.parseInt(output.trim(), 10);
  if (!Number.isFinite(bytes)) {
    throw new Error(`Invalid image size returned for '${image}': ${output.trim()}`);
  }
  console.log(`Image size: ${image} ${formatBytes(bytes)}`);
}

export interface BuildSpec {
  tag: string;          // e.g. localhost/converged-portal-ui:latest
  containerfile: string;
  ignorefile: string;
  context: string;
  buildContexts?: Record<string, string>;
  cwd?: string;
  noCache?: boolean;
}


export async function buildContainer(spec: BuildSpec): Promise<void> {
  const args = ["build"];
  if (spec.noCache) args.push("--no-cache");
  for (const [name, context] of Object.entries(spec.buildContexts ?? {})) {
    args.push("--build-context", `${name}=${context}`);
  }
  args.push("--ignorefile", spec.ignorefile, "-f", spec.containerfile, "-t", spec.tag, spec.context);
  await run(
    "podman",
    args,
    spec.cwd,
  );
  await printImageSize(spec.tag);
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
