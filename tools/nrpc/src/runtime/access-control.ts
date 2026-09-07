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
 * * `rp` — a repository microservice (`rp/files/save(w)`)
 * * `ap` — a native application (`ap/resonus/call(w)`)
 * * `wf` — a workflow, executed rather than called (`wf/file-processing(x)`)
 * * `lm` — a lambda (`lm/thumbnail(x)`)
 *
 * A grant written without one — `files/save(w)` — matches any kind, so presets
 * issued before kinds existed keep working unchanged.
 */
export type PermissionKind = string;

/** Stands for "no kind named", on both sides of a comparison. */
const ANY_KIND = "";

export type PermissionEntry = {
	kind?: PermissionKind;
	service: string;
	method: string;
	mode: AccessMode;
};

/** kind -> service -> method -> mode. */
export type PermissionIndex = Map<string, Map<string, Map<string, AccessMode>>>;

const PERMISSION_RE =
	/^(?:([^/\s]+)\s*\/\s*)?([^/\s]+)\s*\/\s*([^\s(]+)\s*(?:\(\s*([rwx]+)\s*\))?$/i;
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

/** `[kind/]service/method[(mode)]`. Two segments leave the kind unset. */
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

export function deserializePermissions(values: string[]): PermissionEntry[] {
	return values
		.map((value) => parsePermission(value))
		.filter(Boolean) as PermissionEntry[];
}

export function serializePermissions(entries: PermissionEntry[]): string[] {
	return entries.map((entry) => serializePermission(entry));
}

export function buildPermissionIndex(permissions: string[]): PermissionIndex {
	const index: PermissionIndex = new Map();
	for (const raw of permissions ?? []) {
		const parsed = parsePermission(raw);
		if (!parsed) continue;
		const kindKey = parsed.kind ? normalizeName(parsed.kind) : ANY_KIND;
		const serviceKey = normalizeName(parsed.service);
		const methodKey = normalizeName(parsed.method);
		if (!index.has(kindKey)) index.set(kindKey, new Map());
		const kindMap = index.get(kindKey)!;
		if (!kindMap.has(serviceKey)) kindMap.set(serviceKey, new Map());
		const serviceMap = kindMap.get(serviceKey)!;
		serviceMap.set(
			methodKey,
			mergeModes(serviceMap.get(methodKey), parsed.mode),
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

	// A grant with no kind of its own answers a question about any kind, which is
	// what every permission issued before kinds existed relies on.
	const candidateKinds = kind
		? [ANY_KIND, normalizeName(kind), "all", "*"]
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

export function extractPermissionsFromPayload(payload: any): string[] {
	const raw = payload?.perm ?? payload?.permissions;
	if (Array.isArray(raw)) {
		return raw.filter((item) => typeof item === "string") as string[];
	}
	if (typeof raw === "string") {
		return raw
			.split(",")
			.map((item) => item.trim())
			.filter(Boolean);
	}
	return [];
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

	constructor(permissions: string[] = []) {
		this.index = buildPermissionIndex(permissions);
	}

	/** Asks about any kind. What a caller that predates kinds wants. */
	can(service: string, method: string, required: AccessMode): boolean {
		return hasAccess(this.index, service, method, required);
	}

	/** Asks about one kind: `wf/report(x)` answers, `rp/report(x)` does not. */
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
	permissions: string[],
	metadata: ServiceMetadata,
	methodName: string,
	required?: AccessMode,
): boolean {
	const matcher = new AccessMatcher(permissions);
	const access = required ?? resolveAccessForMethod(methodName);
	return matcher.can(metadata.serviceName, methodName, access);
}
