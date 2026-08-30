/**
 * The client half of the module registry.
 *
 * A Solution names modules. It does not carry them and it does not say where
 * they are: the name is resolved against a mapping ptah publishes, and the
 * bytes are fetched from ptah by digest. Three environment variables are the
 * whole contract, and all three arrive together in the module ConfigMap so a
 * module list can never be current while the mapping behind it is stale.
 *
 *   MODULE_PROXY      ptah's content-addressed proxy, e.g. http://ptah-proxy
 *   MODULE_DIGESTS    {"ms-orders.js": "<sha256>"} — the whole naming layer
 *   MODULE_CACHE_DIR  where this pod keeps what it has already fetched
 *
 * Unset means there is no registry, which is what a dev run and a local image
 * look like: callers fall back to resolving modules from source. That is a
 * different mode, not a degraded one, so this returns null rather than throwing.
 *
 * Objects are brotli — see `core/tools/registry/src/build.ts`. The digest covers
 * the compressed bytes, so verification happens on exactly what came off the
 * wire, before anything decodes it. A digest that does not match is never
 * written and never returned: without that check content addressing is
 * decoration, since a substituted file would travel under the right name.
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";

export type ModuleRegistry = {
	/** The digest a name currently resolves to, or null if it names nothing. */
	digest(artifact: string): string | null;
	/**
	 * Path to a local file holding the module's javascript, fetching it if this
	 * pod has not seen that digest yet. The path is stable per digest, so
	 * `import()` of it is cached by the runtime the same way a source file is.
	 */
	load(artifact: string): Promise<string>;
	/** The compressed bytes, verified. What the ui hands a browser unchanged. */
	object(artifact: string): Promise<Uint8Array>;
	/** For logs: which mapping this pod is running against. */
	revision: string;
};

export class ModuleRegistryError extends Error {}

/**
 * The function catalogue's metadata: not a module, but published as one because
 * it describes the modules and has to move when they do. Named here rather than
 * in the builder so the side that writes it and the side that serves it agree
 * without either importing the other.
 */
export const OBJECT_INDEX = "mf-index.json";

function parseDigests(raw: string): Record<string, string> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		throw new ModuleRegistryError("MODULE_DIGESTS must be valid JSON");
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new ModuleRegistryError("MODULE_DIGESTS must be a JSON object");
	}
	for (const [name, digest] of Object.entries(parsed)) {
		if (typeof digest !== "string" || !/^[0-9a-f]{64}$/i.test(digest)) {
			throw new ModuleRegistryError(
				`MODULE_DIGESTS["${name}"] is not a sha256 digest`,
			);
		}
	}
	return parsed as Record<string, string>;
}

function sha256(bytes: Uint8Array): string {
	return new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
}

export function moduleRegistryFromEnv(
	env: Record<string, string | undefined> = process.env,
): ModuleRegistry | null {
	const proxy = env.MODULE_PROXY?.trim().replace(/\/+$/, "");
	if (!proxy) return null;

	const digests = parseDigests(env.MODULE_DIGESTS?.trim() || "{}");
	const cacheDir = env.MODULE_CACHE_DIR?.trim();
	if (!cacheDir) {
		throw new ModuleRegistryError(
			"MODULE_PROXY is set but MODULE_CACHE_DIR is not; ptah publishes both",
		);
	}
	mkdirSync(cacheDir, { recursive: true });

	// One fetch per digest even when several names resolve to the same bytes,
	// and even when a burst of loads races: the promise is the cache entry.
	const inFlight = new Map<string, Promise<Uint8Array>>();

	function resolve(artifact: string): string {
		const digest = digests[artifact];
		if (!digest) {
			throw new ModuleRegistryError(
				`${artifact} is not in the registry mapping (revision ${revision})`,
			);
		}
		return digest;
	}

	async function fetchObject(digest: string): Promise<Uint8Array> {
		const cached = Bun.file(join(cacheDir, digest));
		if (await cached.exists()) {
			const bytes = new Uint8Array(await cached.arrayBuffer());
			// The entry is re-verified rather than trusted for being present: the
			// cache is a volume, and a volume can be restored, shared by mistake, or
			// half-written by a killed pod.
			if (sha256(bytes) === digest) return bytes;
		}

		const response = await fetch(`${proxy}/${digest}`);
		if (!response.ok) {
			throw new ModuleRegistryError(
				`${proxy}/${digest}: ptah answered ${response.status}`,
			);
		}
		const bytes = new Uint8Array(await response.arrayBuffer());
		if (sha256(bytes) !== digest) {
			throw new ModuleRegistryError(
				`${proxy}/${digest}: digest mismatch, refusing the bytes`,
			);
		}
		await Bun.write(join(cacheDir, digest), bytes);
		return bytes;
	}

	function object(artifact: string): Promise<Uint8Array> {
		const digest = resolve(artifact);
		const pending = inFlight.get(digest) ?? fetchObject(digest);
		inFlight.set(digest, pending);
		return pending;
	}

	const revision = env.MODULE_REGISTRY_REVISION?.trim() || "(unversioned)";

	return {
		revision,
		digest: (artifact) => digests[artifact] ?? null,
		object,
		async load(artifact) {
			const digest = resolve(artifact);
			const script = join(cacheDir, `${digest}.js`);
			// Decompressed once per digest. Written only after the compressed form
			// verified, so this file's provenance is the digest's even though its
			// own bytes hash to something else.
			if (!existsSync(script)) {
				await Bun.write(
					script,
					new Uint8Array(brotliDecompressSync(await object(artifact))),
				);
			}
			return script;
		},
	};
}
