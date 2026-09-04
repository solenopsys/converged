/**
 * The registry's naming layers.
 *
 * A product build ships only its own modules — converged's are converged's to
 * build and publish — but `modules.json` claims to be the whole naming layer,
 * and every build used to write it at the same key. Whichever published last
 * therefore deleted the other's names, and a platform running the merged
 * solution then asked for a backend module the mapping no longer mentioned:
 * `REPOSITORIES` said `struct`, `MODULE_DIGESTS` had never heard of it.
 *
 * So each layer owns a file nobody else writes, and the mapping every consumer
 * reads is composed from all of them. Publishing order stops mattering, and no
 * build can erase names it did not create.
 */

/** Where layer files live, relative to the registry root. */
export const LAYERS_PREFIX = "layers";

/** One layer's names, and the layers it sits on top of. */
export type LayerFile = {
	layer: string;
	/** Layers this one is stacked on, base first. */
	extends: string[];
	/** How module objects in this layer are compressed. */
	encoding: "br";
	modules: Record<string, string>;
	/** Raw JavaScript sources executed by Centimanus. */
	workflows?: Record<string, string>;
};

/**
 * Every layer's names, folded into the one mapping a consumer reads.
 *
 * Order is by dependency rather than by listing order: a layer is emitted after
 * the ones it extends, so a product that deliberately replaces a base module
 * wins, and the result does not depend on which build ran last.
 *
 * A layer naming a base that is not present is not an error — a registry can
 * legitimately hold a product whose base has not published yet — but its own
 * names still land, so the mapping degrades to what exists instead of failing.
 */
export function mergeLayers(
	layers: LayerFile[],
	kind: "modules" | "workflows" = "modules",
): Record<string, string> {
	const byName = new Map(layers.map((layer) => [layer.layer, layer]));
	const merged: Record<string, string> = {};
	const done = new Set<string>();

	const visit = (name: string, seen: Set<string>) => {
		if (done.has(name)) return;
		const layer = byName.get(name);
		if (!layer) return;
		if (seen.has(name))
			throw new Error(`[registry] layer cycle through ${name}`);
		seen.add(name);
		for (const base of layer.extends) visit(base, seen);
		done.add(name);
		Object.assign(merged, layer[kind] ?? {});
	};

	for (const layer of layers) visit(layer.layer, new Set());
	return merged;
}
