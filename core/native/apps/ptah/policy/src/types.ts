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

/**
 * How storage is divided — the only thing a profile actually decides.
 *
 *   mono   one behemoth pod for the whole platform
 *   multi  behemoth sharded by scope, one pod per shard
 *   cloud  one behemoth pod per tenant, owned by the Tenant reconciler
 *
 * In every profile a repository still gets its own volume; the profile only
 * says how many pods those volumes are spread across.
 */
export type Profile = "mono" | "multi" | "cloud";

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

/**
 * One behemoth shard of a `multi` platform.
 *
 * A shard owns a set of scopes, and the scope index tells every stateless pod
 * which shard to talk to. Exactly one shard must claim `"*"`: without a
 * catch-all an unknown scope has nowhere to go, and with two the choice would
 * depend on map order.
 */
export interface ShardSpec {
	name: string;
	scopes: string[];
	/** Overrides `spec.storage.size` for this shard's volumes. */
	size?: string;
	/** Pins the shard's pod; the volumes usually follow one node. */
	nodeAffinity?: Record<string, unknown>;
	resources?: Resources;
}

/**
 * Where modules and their configuration are fetched from at runtime.
 *
 * Solutions name modules; they do not carry them. The bundles and the base
 * solution configuration live in a remote registry (S3 or any HTTP object
 * store) and are cached on first use, so activating a solution never means
 * rebuilding or republishing an image.
 *
 * The policy only propagates these values — it cannot fetch anything itself.
 */
export interface RegistrySpec {
	/** Base URL of the registry, e.g. `https://s3.eu-central-1.../converged`. */
	url: string;
	/** Immutable registry paths mapped to lowercase SHA-256 digests. */
	modules: Record<string, string>;
	/** Workflow script path -> digest. Workflow sources are raw JavaScript. */
	workflows?: Record<string, string>;
	/** Key of the base solution configuration within the registry. */
	solutions: string;
	/** Immutable content revision; changing it forces a re-fetch and a rollout. */
	revision?: string;
}

export interface PlatformSpec extends ExtraResources {
	profile: Profile;
	namespace: string;
	domainBase: string;
	secretName: string;
	images: { ui: string; ms: string };
	storage: {
		image: string;
		size: string;
		port: number;
		/**
		 * Valkey port. Behemoth runs the cache in-process, so there is no
		 * separate cache workload to deploy — only a second port to publish on
		 * the storage Service.
		 */
		cachePort: number;
		mountBase: string;
		/** Required: the cluster default class differs per cluster. */
		storageClassName: string;
		/**
		 * Static PV source template. Omit it and each repository gets a claim
		 * alone, for the provisioner behind `storageClassName` to fill; set it
		 * and ptah declares the volumes too, which means `storageClassName` has
		 * to name a class with no provisioner of its own — two owners for one
		 * claim is a race, not a configuration.
		 *
		 * Every active repository gets a distinct PV/PVC pair; `{{volume}}`
		 * is replaced with that pair's unique name. Other available
		 * placeholders are `{{platform}}`, `{{tenant}}`, `{{shard}}`, and
		 * `{{repository}}`. A node-local source additionally requires
		 * `nodeAffinity`.
		 */
		volumeSource?: Record<string, unknown>;
		accessModes?: string[];
		reclaimPolicy?: "Retain" | "Delete" | "Recycle";
		nodeAffinity?: Record<string, unknown>;
		resources?: Resources;
		/**
		 * UID the behemoth image runs as. The volumes arrive owned by root —
		 * `hostPath` dirs are created by the kubelet and `fsGroup` is not
		 * applied to them — so an unprivileged behemoth cannot write a single
		 * store and every op comes back `AccessDenied`. An init container
		 * hands the mounts over to this UID before behemoth starts.
		 */
		runAsUser?: number;
	};
	/** Behemoth shards. Required by `multi`, ignored by the other profiles. */
	shards?: ShardSpec[];
	registry?: RegistrySpec;
	/** Always-on peers of the bus: fujin, centimanus, resonus. */
	apps: Record<string, NativeApp>;
	/**
	 * Compute peers deployed only when a solution asks for them — slicers, CAM,
	 * converters. Declaring one here costs nothing until it is selected.
	 */
	processors?: Record<string, NativeApp>;
	/**
	 * Routing via Gateway API. One Gateway per platform; tenants attach their
	 * own HTTPRoutes to it, so adding a site never touches the load balancer.
	 */
	gateway: {
		className: string;
		hosts: string[];
		/** HTTPS port exposed by the Gateway controller's entry point. */
		httpsPort?: number;
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
	id?: string;
	name: string;
	script: string;
	brief?: string;
	description?: string;
	parameters?: Record<string, unknown>;
	periodMs?: number;
	params?: Record<string, unknown>;
}

export interface SolutionSpec extends ExtraResources {
	/** Platform this solution is layered onto. */
	platform: string;
	enabled?: boolean;
	repositories?: string[];
	lambdas?: string[];
	surfaces?: string[];
	/** Names from the platform's `spec.processors` this solution needs. */
	processors?: string[];
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
	/**
	 * Namespace the controller itself runs in. The module proxy is a Service
	 * there while the pods fetching from it live in the platform's namespace,
	 * so the URL has to be qualified with this rather than left bare.
	 */
	controllerNamespace?: string;
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
