/**
 * The whole contract between the Zig controller runtime and this policy layer.
 *
 * Zig owns every side effect: API sockets, retries, apply, prune, status.
 * This layer is a pure function `observed -> desired`. It has no I/O, no
 * clock, and no access to the cluster; anything it cannot derive from its
 * input is a contract bug, not something to go fetch.
 */

export interface ObjectMeta {
	name: string;
	namespace?: string;
	labels?: Record<string, string>;
	annotations?: Record<string, string>;
	generation?: number;
}

export interface KubeObject {
	apiVersion: string;
	kind: string;
	metadata: ObjectMeta;
	[key: string]: unknown;
}

export type Profile = "mono" | "cloud";

export interface Resources {
	requests?: { cpu?: string; memory?: string };
	limits?: { cpu?: string; memory?: string };
}

export interface NativeApp {
	image: string;
	/** Named container ports. `fujin` must declare `ws` and `zmq`. */
	ports?: Record<string, number>;
	/** Fujin routing target this peer registers under. */
	fujinTarget?: string;
	/** Env var through which this peer receives the Fujin ZMQ endpoint. */
	fujinEndpointEnv?: string;
	/** Maps a port name to the env var the app reads its listen port from. */
	portEnv?: Record<string, string>;
	hostNetwork?: boolean;
	replicas?: number;
	resources?: Resources;
	env?: Record<string, string>;
}

/**
 * Storage, ConfigMaps and Secrets a Platform or Solution declares directly.
 * These exist so a script can manage cluster state without a code change:
 * add an entry, and the next reconcile applies it.
 */
export interface ExtraResources {
	/** name -> data */
	configMaps?: Record<string, Record<string, string>>;
	/** name -> stringData. See the caveat on `k8s.secret`. */
	secrets?: Record<string, Record<string, string>>;
	/** name -> standalone PersistentVolumeClaim. */
	claims?: Record<string, ClaimDecl>;
	/** name -> statically provisioned PersistentVolume (cluster-scoped). */
	volumes?: Record<string, VolumeDecl>;
}

export interface ClaimDecl {
	size: string;
	storageClassName: string;
	accessModes?: string[];
	/** Bind to a specific PersistentVolume rather than provisioning one. */
	volumeName?: string;
	/**
	 * Whether prune may delete this claim. Defaults to retain, so removing it
	 * from the policy orphans the claim instead of destroying the data.
	 */
	reclaim?: "retain" | "delete";
}

export interface VolumeDecl {
	capacity: string;
	storageClassName: string;
	accessModes?: string[];
	reclaimPolicy?: "Retain" | "Delete" | "Recycle";
	/** Volume source verbatim, e.g. `{ "hostPath": { "path": "/data" } }`. */
	source: Record<string, unknown>;
	nodeAffinity?: Record<string, unknown>;
	reclaim?: "retain" | "delete";
}

export interface PlatformSpec extends ExtraResources {
	profile: Profile;
	namespace: string;
	domainBase: string;
	secretName: string;
	images: { ui: string; ms: string };
	cache: { image: string; port: number; resources?: Resources };
	storage: {
		image: string;
		size: string;
		port: number;
		mountBase: string;
		/** Required: the cluster default class differs per cluster. */
		storageClassName: string;
		/**
		 * Static PV source template. Every active microservice gets a distinct
		 * PV/PVC pair; `{{volume}}` is replaced with that pair's unique name.
		 * Other available placeholders are `{{platform}}`, `{{tenant}}`, and
		 * `{{microservice}}`.
		 */
		volumeSource: Record<string, unknown>;
		accessModes?: string[];
		reclaimPolicy?: "Retain" | "Delete" | "Recycle";
		nodeAffinity?: Record<string, unknown>;
		resources?: Resources;
	};
	apps: Record<string, NativeApp>;
	/**
	 * Routing via Gateway API. One Gateway per platform; tenants attach their
	 * own HTTPRoutes to it, so adding a site never touches the load balancer.
	 */
	gateway: {
		className: string;
		hosts: string[];
		tls?: {
			secretName: string;
			issuer?: string;
			issuerKind?: "ClusterIssuer" | "Issuer";
			dnsNames?: string[];
		};
	};
	replicas?: { ui?: number; ms?: number };
	resources?: { ui?: Resources; ms?: Resources };
	env?: Record<string, string>;
}

export interface WorkflowRef {
	name: string;
	script: string;
	periodMs?: number;
	params?: Record<string, unknown>;
}

export interface SolutionSpec extends ExtraResources {
	/** Platform this solution is layered onto. */
	platform: string;
	enabled?: boolean;
	microservices?: string[];
	microfrontends?: string[];
	workflows?: WorkflowRef[];
	env?: Record<string, string>;
}

export interface TenantSpec {
	platform: string;
	storageSize?: string;
	domains?: string[];
	/** Solutions active for this tenant; empty means every enabled solution. */
	solutions?: string[];
}

export type ReconcileKind = "Platform" | "Solution" | "Tenant";

export interface ReconcileInput {
	kind: ReconcileKind;
	/** The custom resource being reconciled. */
	object: KubeObject;
	/** Every Solution known to the controller, enabled or not. */
	solutions: KubeObject[];
	/** Platform referenced by a Tenant or Solution; absent when reconciling one. */
	platform?: KubeObject;
	/** Tenants of the platform, for cloud-profile aggregation. */
	tenants: KubeObject[];
}

export interface ReconcileOutput {
	/**
	 * Full desired state owned by this resource. Anything the controller
	 * currently owns and that is missing here gets pruned, so a partial list
	 * is a deletion request — never emit one on an error path.
	 */
	resources: KubeObject[];
	/** Merged into the resource's `.status` subresource. */
	status: Record<string, unknown>;
	/** Milliseconds until the next forced reconcile; 0 leaves it to resync. */
	requeueAfter: number;
	/**
	 * Whether `resources` is the authoritative desired set. Default true.
	 *
	 * Set it to false when the policy could not compute the full state — a
	 * dangling reference, a dependency that has not appeared yet. Without it
	 * an empty list on a transient error reads as "delete everything I own",
	 * which would take a tenant's storage down while waiting for its platform.
	 */
	prune?: boolean;
}

/** Thrown by policy code; the controller turns it into a status condition. */
export class PolicyError extends Error {}

export function require<T>(value: T | undefined | null, what: string): T {
	if (value === undefined || value === null || value === "") {
		throw new PolicyError(`missing required field: ${what}`);
	}
	return value;
}
