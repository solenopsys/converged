import type {
	LandingBlockConfig,
	LandingConfig,
	LandingMenuLink,
	LandingNavigationConfig,
	LandingPayload,
	ResolvedBlock,
} from "front-core/landing";
import { createStructServiceClient } from "g-struct";
import { createSsrNrpcClientConfig } from "../nrpc";




const GALERY_STATIC_RE = /\/(?:services\/)?galery\/static\//g;

function normalizeImageUrls<T>(value: T): T {
	if (typeof value === "string") {
		return (value.includes("galery/static/")
			? value.replace(GALERY_STATIC_RE, "/images/")
			: value) as T;
	}
	if (Array.isArray(value)) return value.map((item) => normalizeImageUrls(item)) as T;
	if (value && typeof value === "object") {
		const out: Record<string, unknown> = {};
		for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
			out[key] = normalizeImageUrls(item);
		}
		return out as T;
	}
	return value;
}

function readString(value: unknown): string {
	return typeof value === "string" ? value.trim() : "";
}


function blockNavLabel(block: ResolvedBlock | undefined): string {
	if (!block) return "";
	const explicit = readString(block.props.navLabel);
	if (explicit) return explicit;

	for (const source of Object.values(block.data)) {
		if (!source || typeof source !== "object") continue;
		const record = source as Record<string, unknown>;
		for (const key of ["navLabel", "title", "railLabel", "headline", "eyebrow"]) {
			const value = readString(record[key]);
			if (value) return value;
		}
	}
	return "";
}

function resolveNavigation(
	navigation: LandingNavigationConfig | undefined,
	blocks: ResolvedBlock[],
): { menuLinks?: LandingMenuLink[] } | undefined {
	const blockById = new Map(blocks.map((block) => [block.id, block]));
	const menuLinks = (navigation?.menuLinks ?? []).flatMap((item): LandingMenuLink[] => {
		const targetId = readString(item.blockId);
		const href = readString(item.href) || (targetId ? `#${targetId.replace(/^#/, "")}` : "");
		const label = readString(item.label) || blockNavLabel(blockById.get(targetId));
		return label && href ? [{ label, href }] : [];
	});

	return menuLinks.length > 0 ? { menuLinks } : undefined;
}

type StructReader = { readJsonBatch(paths: string[]): Promise<unknown[]> };

/**
 * Loads the language-free document sets a page asks for.
 *
 * A collection is a directory in the root of `struct`, outside any locale, with
 * an `index.json` naming its members. Two round trips read the whole thing: one
 * for every manifest, one for every member across every collection — so adding
 * a diagram costs a file, not a request.
 */
async function readCollections(
	struct: StructReader,
	blocks: LandingBlockConfig[],
): Promise<Map<string, Record<string, unknown>>> {
	const dirs = [
		...new Set(
			blocks.flatMap((block) =>
				Object.values(block.collections ?? {}).filter(
					(value): value is string => typeof value === "string" && value.trim().length > 0,
				),
			),
		),
	];
	if (dirs.length === 0) return new Map();

	const indexes = (await struct.readJsonBatch(
		dirs.map((dir) => `${dir}/index.json`),
	)) as Array<{ entries?: string[] } | undefined>;

	const members = dirs.map((dir, index) => {
		const ids = indexes[index]?.entries;
		if (!Array.isArray(ids)) {
			throw new Error(`[landing] collection ${dir} has no index.json manifest`);
		}
		return { dir, ids };
	});

	const paths = members.flatMap(({ dir, ids }) => ids.map((id) => `${dir}/${id}.json`));
	const documents = await struct.readJsonBatch(paths);

	const result = new Map<string, Record<string, unknown>>();
	let cursor = 0;
	for (const { dir, ids } of members) {
		const entries: Record<string, unknown> = {};
		for (const id of ids) entries[id] = documents[cursor++];
		result.set(dir, entries);
	}
	return result;
}

export async function prefetchLanding(
	configPath: string,
	workspace?: string,
): Promise<LandingPayload> {
	const struct = createStructServiceClient(createSsrNrpcClientConfig({ scope: workspace }));
	const config = (await struct.readJson(configPath)) as LandingConfig;

	const locale = configPath.split("/")[0] ?? "";
	const localize = (path: string) =>
		!locale || /^[a-z]{2}\//.test(path) || path.startsWith(`${locale}/`) ? path : `${locale}/${path}`;

	const blocks = Array.isArray(config?.blocks) ? config.blocks : [];
	if (blocks.length === 0) {
		throw new Error(`[landing] config ${configPath} has no blocks`);
	}

	const sourcePaths = Array.from(
		new Set(
			blocks.flatMap((block) =>
				Object.values(block.sources ?? {}).filter(
					(value): value is string => typeof value === "string" && value.trim().length > 0,
				),
			),
		),
	).map(localize);

	const sourceValues = sourcePaths.length > 0 ? await struct.readJsonBatch(sourcePaths) : [];
	const sourceMap = new Map<string, unknown>();
	sourcePaths.forEach((path, index) => {
		sourceMap.set(path, Array.isArray(sourceValues) ? sourceValues[index] : undefined);
	});

	const collections = await readCollections(struct, blocks);

	const resolved: ResolvedBlock[] = blocks.map((block, index) => {
		const data: Record<string, unknown> = {};
		for (const [alias, sourcePath] of Object.entries(block.sources ?? {})) {
			const value = sourceMap.get(localize(sourcePath));
			if (value === undefined || value === null) {
				throw new Error(`[landing] missing source ${sourcePath} for block ${block.type}`);
			}
			data[alias] = value;
		}
		for (const [alias, dir] of Object.entries(block.collections ?? {})) {
			const value = collections.get(dir);
			if (!value) {
				throw new Error(`[landing] missing collection ${dir} for block ${block.type}`);
			}
			data[alias] = value;
		}

		return {
			id: block.id || `${block.type}-${index}`,
			type: block.type,
			props: block.props ?? {},
			data,
		};
	});

	const normalized = normalizeImageUrls(resolved);

	return {
		configPath,
		navigation: resolveNavigation(config.navigation, normalized),
		blocks: normalized,
	};
}
