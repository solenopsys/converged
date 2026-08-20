import { mkdirSync, readFileSync, rmSync, writeFileSync, chmodSync } from "fs";
import { dirname, join } from "path";
import { homedir } from "os";
import { BaseCommandProcessor, type Handler, type CommandEntry } from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import { createAuthServiceClient, type AuthServiceClient } from "g-auth/browser";
import { createIdentityServiceClient, type IdentityServiceClient } from "g-identity/browser";
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
  | { mode: "request"; email: string }
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

function parseLoginParams(rawParam?: string): LoginInput {
  const value = (rawParam ?? "").trim();
  if (!value) {
    throw new Error("Usage: auth login <email> | <magic-link-or-token>");
  }

  const magicToken = extractMagicToken(value);
  if (magicToken) {
    return { mode: "magic", token: magicToken };
  }

  if (value.includes("@")) {
    return { mode: "request", email: value };
  }

  throw new Error(`Not an email or a magic link: "${value}"`);
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
      const identityClient: IdentityServiceClient = createIdentityServiceClient(createCliNrpcClientConfig());
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

// Auth over HTTP, not over Fujin: the whole flow lives in the UI gateway, and
// going through it is also what lets the CLI sign in while its own session is
// dead — the channel would refuse the call that fixes the channel.
function resolveGatewayUrl(): string {
  const configured = process.env.AUTH_GATEWAY_URL?.trim();
  // Deriving it from SERVICES_URL guesses wrong: the gateway is mounted on the
  // UI host, which is a different port from the services one. A wrong guess
  // shows up as a 404 that looks like a broken endpoint, so demand the address.
  if (!configured) {
    throw new Error(
      "AUTH_GATEWAY_URL is not set: point it at the UI host that serves /auth/* (front/landing, PORT 3002 by default)",
    );
  }
  return configured.replace(/\/+$/, "");
}

async function requestMagicLink(email: string): Promise<void> {
  const gateway = resolveGatewayUrl();
  const response = await fetch(`${gateway}/auth/magic-link`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!response.ok) {
    throw new Error(
      `Magic link request failed: ${response.status} ${await response.text()}`,
    );
  }
  // The gateway answers the same way for every address, so this is a promise to
  // send mail — not proof that the account exists.
  console.log(`Magic link sent to ${email} (if the address is registered).`);
  console.log("Then run: bun cli auth login <link-from-the-email>");
}

/** Walks the browser's path by hand: verify sets the cookie, session spends it. */
async function exchangeMagicToken(token: string): Promise<AuthSession> {
  const gateway = resolveGatewayUrl();

  const verified = await fetch(
    `${gateway}/auth/verify?token=${encodeURIComponent(token)}`,
    { redirect: "manual" },
  );
  const cookies = verified.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  if (!cookies) {
    throw new Error(
      `Magic link was not accepted (${verified.status}) — it is used up or expired`,
    );
  }

  const session = await fetch(`${gateway}/auth/session`, {
    headers: { cookie: cookies },
  });
  const body = (await session.json()) as { token?: string };
  if (!session.ok || !body.token) {
    throw new Error(`Gateway issued no access token (${session.status})`);
  }

  const payload = parseJwtPayload(body.token);
  return {
    baseUrl: resolveBaseUrl(),
    email: payload?.email ?? "",
    userId: payload?.sub ?? "",
    token: body.token,
    permissions: extractPermissionsFromPayload(payload),
    savedAt: new Date().toISOString(),
  };
}

const loginHandler: Handler = async (_client: AuthServiceClient, _splitter, param) => {
  const input = parseLoginParams(param);

  if (input.mode === "request") {
    await requestMagicLink(input.email);
    return;
  }

  const session = await exchangeMagicToken(input.token);
  const path = saveSession(session);
  console.log(`Signed in as ${session.email || session.userId}`);
  console.log(`Session saved: ${path}`);
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
      ["login", { handler: loginHandler, description: "Send a magic link to an email, or sign in with the link/token from it: auth login <email> | <magic-link-or-token>" }],
      ["status", { handler: statusHandler, description: "Show current auth status (email, permissions, raw token)" }],
      ["logout", { handler: logoutHandler, description: "Logout and remove local session" }],
    ]);
  }
}

export default () => {
  const client: AuthServiceClient = createAuthServiceClient(createCliNrpcClientConfig());
  const processor = new AuthProcessor(client);
  // Auth is the way out of a bad session, so it must not require a good one:
  // `status` reads the local file, and `logout` clears it even when the remote
  // call cannot go through. Opening the channel up front would block both.
  return Object.assign(processor, { needsChannel: false });
};
