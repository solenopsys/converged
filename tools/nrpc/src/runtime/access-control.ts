import type { ServiceMetadata } from "../types";

/** Any combination of `r`, `w` and `x`, normalized to that order. */
export type AccessMode = string;

/**
 * What a permission is about.
 *
 * Without it every grant reads as a service method, so "may run this workflow"
 * could only be written as "may call the runtime's runWorkflow" — a grant that
 * cannot tell one workflow from another.
 *
 * * `rp` — a repository microservice
 * * `ap` — a native application
 * * `wf` — a workflow, executed rather than called
 * * `lm` — a lambda
 */
export type PermissionKind = string;

/** Stands for "no kind named", on both sides of a comparison. */
const ANY_KIND = "";

/**
 * A single grant, named the way a human points at one: `kind/service/method(mode)`.
 *
 * This is query syntax, not storage. It is what you write to ask "may I?", and
 * what `addPermissionToUser` takes to name the one grant being added. Sets of
 * grants are stored as a `GrantTree`, which does not repeat the kind and the
 * service once per method.
 */
export type PermissionEntry = {
	kind?: PermissionKind;
	service: string;
	method: string;
	mode: AccessMode;
};

/**
 * How a set of grants is stored and put on the wire: `kind -> service -> mode -> methods`.
 *
 * Every level is named once. A service granting thirteen write methods writes
 * `w` once and lists the methods, instead of repeating `ap/resonus/` and `(w)`
 * on thirteen lines:
 *
 * ```json
 * {
 *   "ap": { "resonus": { "session.open": "w", "session.close": "w" } },
 *   "rp": { "files": { "*": "r", "save": "w" } },
 *   "wf": { "workflows": { "*": "x" } }
 * }
 * ```
 *
 * `*` is a wildcard at any level — the last two lines are what the flat syntax
 * spelled `rp/files/*(r)` plus `rp/files/save(w)`. A bare mode in place of the
 * method map covers every method, so full access is `{ "*": { "*": "rwx" } }`.
 */
export type GrantTree = {
	[kind: string]: { [service: string]: GrantMethods };
};

/** Either one mode covering every method, or a mode per named method. */
export type GrantMethods = AccessMode | { [method: string]: AccessMode };

/** kind -> service -> method -> mode. The matcher's lookup shape. */
export type PermissionIndex = Map<string, Map<string, Map<string, AccessMode>>>;

const PERMISSION_RE =
	/^(?:([^/\s]+)\s*\/\s*)?([^/\s]+)\s*\/\s*([^\s(]+)\s*(?:\(\s*([rwx]+)\s*\))?$/i;
const MODE_RE = /^[rwx]+$/i;
const WILDCARDS = new Set(["*", "all"]);

function normalizeName(value: string): string {
	return value.trim().toLowerCase();
}

function normalizeMode(value?: string): AccessMode | null {
	if (!value) return "rwx";
	const chars = value.toLowerCase().split("");
	return composeMode(
		chars.includes("r"),
		chars.includes("w"),
		chars.includes("x"),
	);
}

function composeMode(r: boolean, w: boolean, x: boolean): AccessMode | null {
	const mode = `${r ? "r" : ""}${w ? "w" : ""}${x ? "x" : ""}`;
	return mode.length ? mode : null;
}

function mergeModes(a: AccessMode | undefined, b: AccessMode): AccessMode {
	if (!a) return b;
	return (
		composeMode(
			a.includes("r") || b.includes("r"),
			a.includes("w") || b.includes("w"),
			a.includes("x") || b.includes("x"),
		) ?? b
	);
}

function withoutMode(a: AccessMode, b: AccessMode): AccessMode | null {
	return composeMode(
		a.includes("r") && !b.includes("r"),
		a.includes("w") && !b.includes("w"),
		a.includes("x") && !b.includes("x"),
	);
}

/** `[kind/]service/method[(mode)]` — the query syntax for one grant. */
export function parsePermission(value: string): PermissionEntry | null {
	if (!value) return null;
	const match = value.trim().match(PERMISSION_RE);
	if (!match) return null;
	const mode = normalizeMode(match[4]);
	if (!mode) return null;
	const kind = match[1]?.trim();
	return {
		...(kind ? { kind } : {}),
		service: match[2].trim(),
		method: match[3].trim(),
		mode,
	};
}

export function serializePermission(entry: PermissionEntry): string {
	const mode = normalizeMode(entry.mode) ?? "rwx";
	const head = entry.kind ? `${entry.kind}/` : "";
	return `${head}${entry.service}/${entry.method}(${mode})`;
}

/**
 * Walks the tree into flat grants.
 *
 * Order is the tree's own, so a round trip through `toGrantTree` is stable and
 * a serialized preset does not churn between writes.
 */
export function toPermissionEntries(tree: GrantTree): PermissionEntry[] {
	const entries: PermissionEntry[] = [];
	if (!tree || typeof tree !== "object" || Array.isArray(tree)) return entries;

	for (const [kind, services] of Object.entries(tree)) {
		if (!services || typeof services !== "object" || Array.isArray(services)) {
			continue;
		}
		for (const [service, methods] of Object.entries(services)) {
			for (const entry of methodGrants(kind, service, methods)) {
				entries.push(entry);
			}
		}
	}
	return entries;
}

function* methodGrants(
	kind: string,
	service: string,
	methods: GrantMethods,
): Generator<PermissionEntry> {
	// A bare mode says "every method", which is the only reason a service level
	// may hold a string instead of the method map.
	if (typeof methods === "string") {
		const mode = MODE_RE.test(methods.trim()) ? normalizeMode(methods) : null;
		if (mode) yield { kind, service, method: "*", mode };
		return;
	}
	if (!methods || typeof methods !== "object" || Array.isArray(methods)) return;

	for (const [rawMethod, rawMode] of Object.entries(methods)) {
		const method = rawMethod.trim();
		if (!method || typeof rawMode !== "string") continue;
		if (!MODE_RE.test(rawMode.trim())) continue;
		const mode = normalizeMode(rawMode);
		if (mode) yield { kind, service, method, mode };
	}
}

/** Folds flat grants back into the stored shape, merging modes per method. */
export function toGrantTree(entries: PermissionEntry[]): GrantTree {
	// Collected per method first: two grants on one method must become one
	// mode, not two mode groups that each list it.
	const collected = new Map<string, Map<string, Map<string, AccessMode>>>();

	for (const entry of entries) {
		const kind = entry.kind?.trim() || "*";
		const service = entry.service.trim();
		const method = entry.method.trim();
		const mode = normalizeMode(entry.mode);
		if (!service || !method || !mode) continue;

		if (!collected.has(kind)) collected.set(kind, new Map());
		const services = collected.get(kind)!;
		if (!services.has(service)) services.set(service, new Map());
		const methods = services.get(service)!;
		methods.set(method, mergeModes(methods.get(method), mode));
	}

	const tree: GrantTree = {};
	for (const [kind, services] of collected) {
		const kindNode: { [service: string]: GrantMethods } = {};
		for (const [service, methods] of services) {
			const byMethod: { [method: string]: AccessMode } = {};
			for (const [method, mode] of methods) byMethod[method] = mode;
			// A service whose only grant is the wildcard collapses to the bare
			// mode: `{ "*": { "*": "rwx" } }` reads better than the long way.
			const names = Object.keys(byMethod);
			kindNode[service] =
				names.length === 1 && names[0] === "*" ? byMethod["*"] : byMethod;
		}
		tree[kind] = kindNode;
	}
	return tree;
}

/** Union of two grant sets. What linking a preset to a user does. */
export function mergeGrantTrees(...trees: GrantTree[]): GrantTree {
	return toGrantTree(trees.flatMap((tree) => toPermissionEntries(tree)));
}

/** Adds one grant named in query syntax. Returns a new tree. */
export function grantPermission(tree: GrantTree, permission: string): GrantTree {
	const entry = parsePermission(permission);
	if (!entry) return tree;
	return toGrantTree([...toPermissionEntries(tree), entry]);
}

/**
 * Revokes the modes named by `permission`, leaving any it does not name.
 *
 * Revoking `(w)` from a method held as `rw` leaves `r`: a revocation says which
 * access goes away, not that the method disappears.
 */
export function revokePermission(
	tree: GrantTree,
	permission: string,
): GrantTree {
	const target = parsePermission(permission);
	if (!target) return tree;
	const kind = target.kind?.trim() || "*";

	const kept: PermissionEntry[] = [];
	for (const entry of toPermissionEntries(tree)) {
		const sameKind = normalizeName(entry.kind ?? "*") === normalizeName(kind);
		const sameService =
			normalizeName(entry.service) === normalizeName(target.service);
		const sameMethod =
			normalizeName(entry.method) === normalizeName(target.method);
		if (!sameKind || !sameService || !sameMethod) {
			kept.push(entry);
			continue;
		}
		const remaining = withoutMode(entry.mode, target.mode);
		if (remaining) kept.push({ ...entry, mode: remaining });
	}
	return toGrantTree(kept);
}

/** How many distinct method grants a tree holds. For diagnostics and logs. */
export function countGrants(tree: GrantTree): number {
	return toPermissionEntries(tree).length;
}

export function buildPermissionIndex(tree: GrantTree): PermissionIndex {
	const index: PermissionIndex = new Map();
	for (const entry of toPermissionEntries(tree)) {
		// `*` at the kind level is the tree's way of saying "any kind", which is
		// the empty kind the matcher compares against.
		const rawKind = entry.kind ? normalizeName(entry.kind) : ANY_KIND;
		const kindKey = WILDCARDS.has(rawKind) ? ANY_KIND : rawKind;
		const serviceKey = normalizeName(entry.service);
		const methodKey = normalizeName(entry.method);
		if (!index.has(kindKey)) index.set(kindKey, new Map());
		const kindMap = index.get(kindKey)!;
		if (!kindMap.has(serviceKey)) kindMap.set(serviceKey, new Map());
		const serviceMap = kindMap.get(serviceKey)!;
		serviceMap.set(
			methodKey,
			mergeModes(serviceMap.get(methodKey), entry.mode),
		);
	}
	return index;
}

export function resolveAccessForMethod(methodName: string): AccessMode {
	const lower = methodName.toLowerCase();
	const readPrefixes = [
		"get",
		"list",
		"find",
		"search",
		"status",
		"stats",
		"count",
		"read",
		"fetch",
		"exists",
		"has",
		"is",
		"describe",
	];
	const isRead = readPrefixes.some((prefix) => lower.startsWith(prefix));
	return isRead ? "r" : "w";
}

export function hasAccess(
	index: PermissionIndex,
	service: string,
	method: string,
	required: AccessMode,
	kind: PermissionKind = ANY_KIND,
): boolean {
	const serviceKey = normalizeName(service);
	const methodKey = normalizeName(method);
	const requiredModes = ["r", "w", "x"].filter((bit) => required.includes(bit));

	// A grant written under `*` answers a question about any kind.
	const candidateKinds = kind
		? [ANY_KIND, normalizeName(kind)]
		: [...index.keys()];
	const candidateServices = [serviceKey, "all", "*"];
	const candidateMethods = [methodKey, "all", "*"];

	for (const kindCandidate of candidateKinds) {
		const kindMap = index.get(kindCandidate);
		if (!kindMap) continue;

		for (const serviceCandidate of candidateServices) {
			const serviceMap = kindMap.get(serviceCandidate);
			if (!serviceMap) continue;

			for (const methodCandidate of candidateMethods) {
				const mode = serviceMap.get(methodCandidate);
				if (!mode) continue;
				if (requiredModes.every((bit) => mode.includes(bit))) return true;
			}
		}
	}

	return false;
}

/** Reads the `perm` claim. An absent or malformed claim grants nothing. */
export function extractPermissionsFromPayload(payload: any): GrantTree {
	const raw = payload?.perm ?? payload?.permissions;
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	return raw as GrantTree;
}

export function normalizePermissionTarget(
	service: string,
	method: string,
): { service: string; method: string } {
	return {
		service: WILDCARDS.has(service) ? "all" : normalizeName(service),
		method: WILDCARDS.has(method) ? "all" : normalizeName(method),
	};
}

export class AccessMatcher {
	private index: PermissionIndex;

	constructor(permissions: GrantTree = {}) {
		this.index = buildPermissionIndex(permissions);
	}

	/** Asks about any kind. What a caller that does not care about kinds wants. */
	can(service: string, method: string, required: AccessMode): boolean {
		return hasAccess(this.index, service, method, required);
	}

	/** Asks about one kind: a `wf` grant answers, an `rp` grant does not. */
	canKind(
		kind: PermissionKind,
		service: string,
		method: string,
		required: AccessMode,
	): boolean {
		return hasAccess(this.index, service, method, required, kind);
	}
}

export function canCallMethod(
	permissions: GrantTree,
	metadata: ServiceMetadata,
	methodName: string,
	required?: AccessMode,
): boolean {
	const matcher = new AccessMatcher(permissions);
	const access = required ?? resolveAccessForMethod(methodName);
	return matcher.can(metadata.serviceName, methodName, access);
}
