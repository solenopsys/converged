// Roles are files. This command is the only thing that puts them into the
// cluster: it reads the JSON trees from ./presets and hands them to rp-access,
// which is the service a browser can never call (`@Access("internal")`).
//
// So the workflow is: edit a file, run `access preset seed`, and a role has
// changed everywhere. There is no role table to migrate and no screen to
// rebuild — see ../../../team-contour.md §1 and §3.
import { readdirSync, readFileSync } from "fs";
import { basename, join, resolve } from "path";
import { BaseCommandProcessor, type CommandEntry, type Handler } from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import { createAccessServiceClient, type AccessServiceClient } from "g-access/browser";
import { countGrants, serializePermission, toPermissionEntries, type GrantTree } from "nrpc";

const PRESET_DIR = join(import.meta.dir, "presets");

/** `user` is the base every signed-in person carries; the rest are roles. */
const BASE_PRESET = "user";

function presetPath(name: string): string {
  return join(PRESET_DIR, `${name}.json`);
}

function readPresetFile(target: string): { name: string; permissions: GrantTree } {
  // A bare word means a file shipped with the product; anything else is a path,
  // so an operator can try a tree without committing it first.
  const path = target.includes("/") || target.endsWith(".json") ? resolve(target) : presetPath(target);
  let raw: string;
  try {
    raw = readFileSync(path, "utf8");
  } catch {
    throw new Error(`No such preset file: ${path}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    throw new Error(`${path} is not valid JSON: ${error?.message ?? error}`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${path} must hold a grant tree object`);
  }
  return { name: basename(path, ".json"), permissions: parsed as GrantTree };
}

function shippedPresets(): string[] {
  try {
    return readdirSync(PRESET_DIR)
      .filter((file: string) => file.endsWith(".json"))
      .map((file: string) => basename(file, ".json"))
      .sort();
  } catch {
    return [];
  }
}

function printTree(permissions: GrantTree): void {
  const grants = toPermissionEntries(permissions);
  if (grants.length === 0) {
    console.log("  (empty)");
    return;
  }
  for (const grant of grants) console.log(`  - ${serializePermission(grant)}`);
}

function requireParam(param: string | undefined, usage: string): string[] {
  const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) throw new Error(`Usage: ${usage}`);
  return parts;
}

const listHandler: Handler = async (client: AccessServiceClient) => {
  const stored = await client.getAllPresets();
  const onDisk = new Set(shippedPresets());
  const known = new Set([...stored.map((preset) => preset.name), ...onDisk]);

  console.log("Presets");
  console.log("-------");
  for (const name of [...known].sort()) {
    const live = stored.find((preset) => preset.name === name);
    const grants = live ? countGrants(live.permissions) : 0;
    // An empty tree is the failure this listing exists to make visible: it is
    // what a user sees as "signed in and nothing works".
    const state = !live ? "file only, not seeded" : grants === 0 ? "SEEDED EMPTY" : `${grants} grants`;
    const source = onDisk.has(name) ? "" : "  (no file in ./presets)";
    console.log(`  ${name.padEnd(12)} ${state}${source}`);
  }
};

const showHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [name] = requireParam(param, "access preset show <name>");
  const live = await client.getPreset(name);
  console.log(`${name} — in the cluster:`);
  printTree(live ?? {});

  try {
    const file = readPresetFile(name);
    console.log(`${name} — in ./presets/${name}.json:`);
    printTree(file.permissions);
  } catch {
    console.log(`${name} — no file in ./presets`);
  }
};

const setHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [target] = requireParam(param, "access preset set <name|path/to.json>");
  const { name, permissions } = readPresetFile(target);
  await client.createPreset(name, permissions);
  console.log(`Wrote preset "${name}" (${countGrants(permissions)} grants)`);
};

const seedHandler: Handler = async (client: AccessServiceClient) => {
  const names = shippedPresets();
  if (names.length === 0) throw new Error(`No preset files in ${PRESET_DIR}`);
  for (const name of names) {
    const { permissions } = readPresetFile(name);
    await client.createPreset(name, permissions);
    console.log(`  ${name.padEnd(12)} ${countGrants(permissions)} grants`);
  }
  console.log(`Seeded ${names.length} presets from ${PRESET_DIR}`);
};

const linkHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [userId, preset] = requireParam(param, "access preset link <userId> <preset>");
  if (!preset) throw new Error("Usage: access preset link <userId> <preset>");

  // Roles do not stack: linking one drops the others, so a promotion does not
  // silently leave yesterday's rights attached. The base preset stays.
  const roles = shippedPresets().filter((name) => name !== BASE_PRESET);
  for (const stale of roles) {
    if (stale !== preset) await client.unlinkPresetFromUser(userId, stale);
  }
  await client.linkPresetToUser(userId, BASE_PRESET);
  await client.linkPresetToUser(userId, preset);

  const resolved = await client.getPermissionsMixinFromUser(userId);
  console.log(`${userId}: ${BASE_PRESET} + ${preset} → ${countGrants(resolved)} grants`);
};

const unlinkHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [userId, preset] = requireParam(param, "access preset unlink <userId> <preset>");
  if (!preset) throw new Error("Usage: access preset unlink <userId> <preset>");
  await client.unlinkPresetFromUser(userId, preset);
  console.log(`${userId}: unlinked ${preset}`);
};

const showUserHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [userId] = requireParam(param, "access user <userId>");
  const direct = await client.getPermissionsFromUser(userId);
  const resolved = await client.getPermissionsMixinFromUser(userId);
  const tags = await client.getTagsOfUser(userId);

  console.log(`user:   ${userId}`);
  console.log(`tags:   ${tags.length > 0 ? tags.join(", ") : "(none)"}`);
  console.log("direct grants:");
  printTree(direct);
  console.log(`resolved (presets merged in): ${countGrants(resolved)} grants`);
  printTree(resolved);
};

const tagHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [userId, tag, mode] = requireParam(param, "access tag <userId> <tag> [mode]");
  if (!tag) throw new Error("Usage: access tag <userId> <tag> [mode]");
  await client.addTagToUser(userId, tag, mode ?? "rwx");
  console.log(`${userId}: +${tag}(${mode ?? "rwx"})`);
  console.log("Takes effect in tokens issued from now on — a tag rides the JWT.");
};

const untagHandler: Handler = async (client: AccessServiceClient, _splitter, param) => {
  const [userId, tag] = requireParam(param, "access untag <userId> <tag>");
  if (!tag) throw new Error("Usage: access untag <userId> <tag>");
  await client.removeTagFromUser(userId, tag);
  console.log(`${userId}: -${tag}`);
};

class AccessProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["preset", { handler: presetRouter, description: "Roles as files: access preset list | show <name> | set <name|path> | seed | link <userId> <preset> | unlink <userId> <preset>" }],
      ["user", { handler: showUserHandler, description: "What one user actually holds: access user <userId>" }],
      ["tag", { handler: tagHandler, description: "Put a user in a group: access tag <userId> <tag> [mode]" }],
      ["untag", { handler: untagHandler, description: "Take a user out of a group: access untag <userId> <tag>" }],
    ]);
  }
}

const presetRouter: Handler = async (client, splitter, param) => {
  const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
  const sub = parts.shift() ?? "list";
  const rest = parts.join(" ");
  const routes: Record<string, Handler> = {
    list: listHandler,
    show: showHandler,
    set: setHandler,
    seed: seedHandler,
    link: linkHandler,
    unlink: unlinkHandler,
  };
  const handler = routes[sub];
  if (!handler) {
    throw new Error(`Unknown subcommand "${sub}". Try: ${Object.keys(routes).join(" | ")}`);
  }
  await handler(client, splitter, rest);
};

export default () => {
  const client: AccessServiceClient = createAccessServiceClient(createCliNrpcClientConfig());
  return new AccessProcessor(client);
};
