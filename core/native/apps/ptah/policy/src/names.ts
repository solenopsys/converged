/**
 * Every name and label the controller writes. Kept in one file because a
 * rename here silently orphans live objects: the controller prunes by owner
 * label, so a resource that changes name is deleted and recreated.
 */

export const MANAGED_BY = "ptah";
export const LABEL_MANAGED_BY = "app.kubernetes.io/managed-by";
export const LABEL_NAME = "app.kubernetes.io/name";
export const LABEL_COMPONENT = "app.kubernetes.io/component";
/** Owner back-reference, `<kind>.<name>`, used as the prune selector. */
export const LABEL_OWNER = "ptah.io/owner";
/** Hash of the merged solution set; changing it rolls the workloads. */
export const ANNOTATION_MODULES = "ptah.io/modules";
/** Hash of the scope-to-storage index injected into UI and services. */
export const ANNOTATION_DOMAINS = "ptah.io/domains";
/** Hash of the behemoth mount map; changing it rolls the storage pod. */
export const ANNOTATION_STORAGE_CONFIG = "ptah.io/storage-config";
/**
 * Opt-in permission for prune to delete a data-bearing object. Without it a
 * PersistentVolume or Claim is applied and updated but never removed, so a
 * policy edit cannot destroy storage as a side effect.
 */
export const ANNOTATION_RECLAIM = "ptah.io/reclaim";

export function ownerLabel(kind: string, name: string): string {
	return `${kind.toLowerCase()}.${name}`;
}

export function labels(
	platform: string,
	component: string,
	owner: string,
): Record<string, string> {
	return {
		[LABEL_NAME]: platform,
		[LABEL_COMPONENT]: component,
		[LABEL_MANAGED_BY]: MANAGED_BY,
		[LABEL_OWNER]: owner,
	};
}

/** Selector labels only — must stay stable, they are immutable on a Deployment. */
export function selector(
	platform: string,
	component: string,
): Record<string, string> {
	return { [LABEL_NAME]: platform, [LABEL_COMPONENT]: component };
}

export const ui = (platform: string) => `${platform}-ui`;
export const services = (platform: string) => `${platform}-services`;
export const app = (platform: string, name: string) => `${platform}-${name}`;
export const modulesConfigMap = (platform: string) => `${platform}-modules`;
export const domainsConfigMap = (platform: string) => `${platform}-domains`;

export const tenantStorage = (platform: string, tenant: string) =>
	`${platform}-storage-${tenant}`;
export const tenantRoute = (platform: string, tenant: string) =>
	`${platform}-tenant-${tenant}`;
export const monoStorage = (platform: string) => `${platform}-storage`;
export const shardStorage = (platform: string, shard: string) =>
	`${platform}-storage-${shard}`;
export const storageConfigMap = (storage: string) => `${storage}-config`;

/**
 * The scope every volume of one storage is named under.
 *
 * PersistentVolumes are cluster-scoped, but a Tenant name is already globally
 * unique, so the cloud form is a bare `<tenant>` rather than repeating the
 * Platform and the storage Deployment on every volume. A shard name is only
 * unique within its Platform, so that form stays qualified. Exported because
 * anything reading the volumes back — sync, backup — has to derive the same
 * name, and a second copy of this rule is what makes it look in the wrong PVC.
 */
export const volumeScope = (
	platform: string,
	owner: { tenant?: string | null; shard?: string | null } = {},
): string =>
	owner.tenant ?? (owner.shard ? `${platform}-${owner.shard}` : platform);

/**
 * The key behemoth looks a mount up by.
 *
 * A Solution names a module `orders`, but the running service asks its storage
 * for `orders-ms` — that identifier is compiled into the service and behemoth
 * matches it exactly, refusing any root it was not given. Emitting the bare
 * name here would mount every disk correctly and still fail every store open.
 */
export const storeId = (microservice: string) => `${microservice}-ms`;

/**
 * PV names also become pod volume names, so keep them within the stricter
 * 63-character DNS-label limit and retain a digest when truncation is needed.
 */
export function storageVolume(scope: string, microservice: string): string {
	const raw = `${scope}-${microservice}`.toLowerCase();
	const slug = raw.replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
	const base = slug.length > 0 ? slug : `${scope}-volume`;
	if (base === raw && base.length <= 63) return base;
	return `${base.slice(0, 54).replace(/-+$/g, "")}-${digest(raw)}`;
}
export const gateway = (platform: string) => platform;
export const route = (platform: string) => platform;

/**
 * Gateway listener names must be unique DNS labels, and a hostname is neither
 * — `*.4ir.club` has characters a label cannot hold.
 */
export function listenerName(host: string, index: number): string {
	const slug = host
		.replace(/[^a-z0-9]+/gi, "-")
		.replace(/^-+|-+$/g, "")
		.toLowerCase();
	return slug.length > 0 ? `l${index}-${slug}`.slice(0, 63) : `l${index}`;
}

/** A tenant's scope is its name; the storage shard and headers key off it. */
export const tenantScope = (tenant: string) => tenant.trim();

export function tenantDomains(
	tenant: string,
	domainBase: string,
	extra: string[] = [],
): string[] {
	const auto = `${tenantScope(tenant)}.${domainBase}`;
	const all = [
		auto,
		...extra.map((d) => d.trim().toLowerCase()).filter(Boolean),
	];
	return [...new Set(all)];
}

/**
 * FNV-1a over the canonical module set. Only used to force a rollout, so a
 * short non-cryptographic digest is the right tool.
 */
export function digest(value: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < value.length; i++) {
		hash ^= value.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193) >>> 0;
	}
	return hash.toString(16).padStart(8, "0");
}
