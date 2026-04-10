import { mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";
import { createAuthServiceClient, type AuthServiceClient } from "g-auth";
import { createIdentityServiceClient, type IdentityServiceClient } from "g-identity";
import { AccessMatcher } from "nrpc";

type AuthSession = {
  baseUrl: string;
  email: string;
  userId: string;
  token: string;
  permissions: string[];
  savedAt: string;
};

type LoginInput =
  | { mode: "password"; email: string; password: string }
  | { mode: "magic"; token: string };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function resolveBaseUrl(): string {
  return process.env.SERVICES_URL || process.env.SERVICES_BASE || "http://127.0.0.1:3000/services";
}

function resolveSessionPath(): string {
  return process.env.GESTALT_CLI_SESSION || join(homedir(), ".config", "gestalt", "cli", "session.json");
}

function parseJwtPayload(token: string): any {
  const parts = token.split(".");
  if (parts.length < 2) {
    throw new Error("Invalid JWT format");
  }

  const payload = parts[1]
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(parts[1].length / 4) * 4, "=");

  const json = Buffer.from(payload, "base64").toString("utf8");
  return JSON.parse(json);
}

function extractPermissionsFromPayload(payload: any): string[] {
  const raw = payload?.perm ?? payload?.permissions;
  if (Array.isArray(raw)) {
    return raw.filter((value) => typeof value === "string");
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
  }
  return [];
}

function saveSession(session: AuthSession): string {
  const sessionPath = resolveSessionPath();
  mkdirSync(dirname(sessionPath), { recursive: true });
  writeFileSync(sessionPath, `${JSON.stringify(session, null, 2)}\n`, "utf8");
  chmodSync(sessionPath, 0o600);
  return sessionPath;
}

function readSession(): AuthSession | null {
  const sessionPath = resolveSessionPath();
  try {
    const content = readFileSync(sessionPath, "utf8");
    return JSON.parse(content) as AuthSession;
  } catch {
    return null;
  }
}

function clearSession(): void {
  const sessionPath = resolveSessionPath();
  try {
    rmSync(sessionPath, { force: true });
  } catch {
    // ignore
  }
}

function formatIsoEpochSeconds(value?: unknown): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return new Date(value * 1000).toISOString();
}

function extractMagicToken(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  if (UUID_RE.test(value)) {
    return value;
  }

  if (value.startsWith("token=")) {
    const direct = value.slice("token=".length).trim();
    return direct.length > 0 ? decodeURIComponent(direct) : null;
  }

  try {
    const url = new URL(value);
    const token = url.searchParams.get("token")?.trim();
    if (token) return token;
  } catch {
    // ignore parse error for non-URL input
  }

  const queryMatch = value.match(/[?&]token=([^&#\s]+)/i);
  if (queryMatch?.[1]) {
    return decodeURIComponent(queryMatch[1]);
  }

  // Fallback: treat UUID-like or hex-hyphen strings as raw magic tokens
  // and let backend validate exact correctness/expiry.
  if (!value.includes("@") && /^[0-9a-f-]{20,}$/i.test(value)) {
    return value;
  }

  return null;
}

function parseLoginParams(paramSplitter: string, rawParam?: string): LoginInput {
  const value = (rawParam ?? "").trim();
  if (!value) {
    throw new Error("Usage: auth login <email> [password] | <magic-link-or-token>");
  }

  const magicToken = extractMagicToken(value);
  if (magicToken) {
    return { mode: "magic", token: magicToken };
  }

  const fallbackPassword = process.env.AUTH_PASSWORD;

  if (value.includes(" ")) {
    const [email, ...passwordChunks] = value.split(/\s+/);
    const password = passwordChunks.join(" ").trim() || fallbackPassword;
    if (!password) {
      throw new Error("Password is required: auth login <email> <password> or set AUTH_PASSWORD");
    }
    return { mode: "password", email, password };
  }

  if (value.includes(paramSplitter)) {
    const [email, password] = value.split(paramSplitter, 2);
    const resolvedPassword = (password || "").trim() || fallbackPassword;
    if (!resolvedPassword) {
      throw new Error("Password is required: auth login <email>=<password> or set AUTH_PASSWORD");
    }
    return {
      mode: "password",
      email: email.trim(),
      password: resolvedPassword,
    };
  }

  if (value.includes(":")) {
    const [email, password] = value.split(":", 2);
    const resolvedPassword = (password || "").trim() || fallbackPassword;
    if (!resolvedPassword) {
      throw new Error("Password is required: auth login <email>:<password> or set AUTH_PASSWORD");
    }
    return {
      mode: "password",
      email: email.trim(),
      password: resolvedPassword,
    };
  }

  if (!fallbackPassword) {
    throw new Error("Password is required: auth login <email> <password> or set AUTH_PASSWORD");
  }
  return {
    mode: "password",
    email: value,
    password: fallbackPassword,
  };
}

async function printStatus(session: AuthSession): Promise<void> {
  let payload: any = {};
  try {
    payload = parseJwtPayload(session.token);
  } catch {
    payload = {};
  }

  const tokenPermissions = extractPermissionsFromPayload(payload);
  const permissions = tokenPermissions.length > 0 ? tokenPermissions : session.permissions;
  const canReadIdentity = new AccessMatcher(permissions).can("identity", "getUser", "r");

  let identityEmail = session.email;
  let identityPreset: string | undefined;

  if (canReadIdentity) {
    try {
      const identityClient: IdentityServiceClient = createIdentityServiceClient({
        baseUrl: session.baseUrl,
        headers: { authorization: `Bearer ${session.token}` },
      });
      const user = await identityClient.getUser(session.userId);
      if (user?.email) identityEmail = user.email;
      if (user?.preset) identityPreset = user.preset;
    } catch {
      // Ignore runtime identity lookup errors in debug status command.
    }
  }

  console.log("Auth status");
  console.log("-----------");
  console.log(`sessionFile: ${resolveSessionPath()}`);
  console.log(`baseUrl:     ${session.baseUrl}`);
  console.log(`email:       ${identityEmail}`);
  console.log(`userId:      ${session.userId}`);
  if (identityPreset) {
    console.log(`preset:      ${identityPreset}`);
  }
  console.log(`savedAt:     ${session.savedAt}`);

  const issuedAt = formatIsoEpochSeconds(payload?.iat);
  const expiresAt = formatIsoEpochSeconds(payload?.exp);
  if (issuedAt) console.log(`issuedAt:    ${issuedAt}`);
  if (expiresAt) console.log(`expiresAt:   ${expiresAt}`);

  console.log("permissions:");
  if (permissions.length === 0) {
    console.log("  (empty)");
  } else {
    for (const permission of permissions) {
      console.log(`  - ${permission}`);
    }
  }
  console.log("token:");
  console.log(`  ${session.token}`);
}

const loginHandler: Handler = async (
  client: AuthServiceClient,
  paramSplitter,
  param,
) => {
  const input = parseLoginParams(paramSplitter, param);
  const result = input.mode === "magic"
    ? await client.verifyLink(input.token)
    : await client.login(input.email, input.password);

  const payload = parseJwtPayload(result.token);
  const permissions = extractPermissionsFromPayload(payload);

  const session: AuthSession = {
    baseUrl: resolveBaseUrl(),
    email: result.email,
    userId: result.userId,
    token: result.token,
    permissions,
    savedAt: new Date().toISOString(),
  };

  const sessionPath = saveSession(session);
  console.log(`Session saved: ${sessionPath}`);
  await printStatus(session);
};

const statusHandler: Handler = async () => {
  const session = readSession();
  if (!session) {
    console.log("No active session");
    console.log(`Expected session file: ${resolveSessionPath()}`);
    return;
  }
  await printStatus(session);
};

const logoutHandler: Handler = async (
  client: AuthServiceClient,
) => {
  const session = readSession();
  if (!session) {
    console.log("No active session");
    return;
  }

  try {
    await client.logout(session.userId);
  } catch (error: any) {
    console.error(`Remote logout failed: ${error?.message || String(error)}`);
  }

  clearSession();
  console.log(`Session removed: ${resolveSessionPath()}`);
};

class AuthProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["login", { handler: loginHandler, description: "Login by credentials or magic link/token: auth login <email> [password] | <magic-link-or-token>" }],
      ["status", { handler: statusHandler, description: "Show current auth status (email, permissions, raw token)" }],
      ["logout", { handler: logoutHandler, description: "Logout and remove local session" }],
    ]);
  }
}

export default () => {
  const client: AuthServiceClient = createAuthServiceClient({
    baseUrl: resolveBaseUrl(),
  });
  return new AuthProcessor(client);
};
