/**
 * OpenAI-backed translation pass for files the scanner says need work.
 *
 * Batches run several at a time (see `pool.ts`). Everything that touches the
 * index still happens on the single JS thread that owns the SQLite handle, so
 * concurrency buys the wait on the network and nothing else has to become
 * thread-safe: `store.save` is called from an async continuation, never from
 * a worker.
 */

import { compareJson } from "./compare";
import { isTechnicalString } from "./heuristics";
import { flattenStrings } from "./json-tree";
import { configuredConcurrency, HttpError, pool, withRetry } from "./pool";
import { type ResolvedProvider, resolveProvider } from "./providers";
import {
	buildQueue,
	chunks,
	type Job,
	routeFor,
	STRING_BATCH_ITEMS,
	STRING_MAX_BATCH_CHARS,
} from "./queue";
import { type RunHandle, recordItem } from "./stats";
import type { TranslationStore } from "./store";
import type { JsonValue, ProjectConfig, ProjectSnapshot } from "./types";

/** Counters a concurrent run still has to total up correctly. */
export type Tally = {
	translated: number;
	skipped: number;
	failed: number;
	requests: number;
	retries: number;
	sourceChars: number;
};

function splitPath(path: string): Array<string | number> {
	return path
		.split("/")
		.filter(Boolean)
		.map((segment) => {
			const key = segment.replaceAll("~1", "/").replaceAll("~0", "~");
			return /^\d+$/.test(key) ? Number(key) : key;
		});
}

function setPathValue(root: JsonValue, path: string, value: string): void {
	const segments = splitPath(path);
	let node = root as Record<string | number, JsonValue>;
	for (const segment of segments.slice(0, -1)) {
		node = node[segment] as Record<string | number, JsonValue>;
	}
	node[segments[segments.length - 1]] = value;
}

type Client = {
	provider: ResolvedProvider;
	tally: Tally;
};

/**
 * One source file, all its locales, one request. Returns job id →
 * locale → translated text. A job whose locale is missing from the
 * answer fails the whole file: partial multi-locale answers are not
 * reassembled.
 */
async function requestFile(
	jobs: Job[],
	client: Client,
): Promise<Map<string, Map<string, string>>> {
	const { provider } = client;
	client.tally.requests += 1;
	const response = await fetch(provider.endpoint, {
		method: "POST",
		headers: provider.headers,
		body: JSON.stringify(provider.body(jobs)),
		// No timeout before = a stuck model looked like a hung run.
		signal: AbortSignal.timeout(180_000),
	});
	const body = (await response.json()) as Record<string, unknown>;
	if (!response.ok) {
		// Typed so the backoff in pool.ts can tell a rate limit from a bad
		// request and stop hammering the one it cannot fix by waiting.
		const error = body.error as { message?: string } | undefined;
		throw new HttpError(
			response.status,
			`${provider.label} ${response.status}: ${error?.message ?? "request failed"}`,
		);
	}
	const parsed = JSON.parse(provider.outputText(body)) as {
		items?: Array<{ id?: string; translations?: Record<string, string> }>;
	};
	const byId = new Map(
		(parsed.items ?? []).map((item) => [item.id ?? "", item.translations ?? {}]),
	);
	const translations = new Map<string, Map<string, string>>();
	for (const job of jobs) {
		const perLocale = byId.get(job.id);
		const text = perLocale?.[job.locale];
		if (typeof text !== "string" || text.length === 0) {
			throw new Error(
				`${provider.label} response omitted translation for ${job.id} (${job.locale})`,
			);
		}
		if (!translations.has(job.id)) translations.set(job.id, new Map());
		translations.get(job.id)?.set(job.locale, text);
	}
	return translations;
}

type StringItem = { job: Job; path: string; text: string };

/**
 * The model occasionally drops items from large responses. Instead of
 * aborting the whole run on the first gap, retry the missing subset (each
 * retry is a smaller request) and keep the source text for whatever never
 * comes back — a few untranslated strings beat zero translated files.
 *
 * Transport failures are handled a layer down by `withRetry`; this loop is
 * only about incomplete but well-formed answers.
 */
/**
 * Single-locale batch for the string-level route: one request, one
 * locale, job id → translated string. Kept separate from `requestFile`
 * because string batches mix many files and stay per-locale.
 */
async function requestBatch(
	batch: Job[],
	locale: string,
	client: Client,
): Promise<Map<string, string>> {
	const { provider } = client;
	client.tally.requests += 1;
	const response = await fetch(provider.endpoint, {
		method: "POST",
		headers: provider.headers,
		body: JSON.stringify(
			provider.body(
				batch.map((job) => ({ ...job, locale })),
			),
		),
	});
	const body = (await response.json()) as Record<string, unknown>;
	if (!response.ok) {
		const error = body.error as { message?: string } | undefined;
		throw new HttpError(
			response.status,
			`${provider.label} ${response.status}: ${error?.message ?? "request failed"}`,
		);
	}
	const parsed = JSON.parse(provider.outputText(body)) as {
		items?: Array<{ id?: string; translations?: Record<string, string> }>;
	};
	const translations = new Map<string, string>();
	for (const item of parsed.items ?? []) {
		const text = item.translations?.[locale];
		if (typeof text === "string" && text.length > 0) {
			translations.set(item.id ?? "", text);
		}
	}
	for (const job of batch) {
		if (!translations.get(job.id)) {
			throw new Error(
				`${provider.label} response omitted translation id ${job.id}`,
			);
		}
	}
	return translations;
}

/**
 * The model occasionally drops items from large responses. Instead of
 * aborting the whole run on the first gap, retry the missing subset (each
 * retry is a smaller request) and keep the source text for whatever never
 * comes back — a few untranslated strings beat zero translated files.
 *
 * Transport failures are handled a layer down by `withRetry`; this loop is
 * only about incomplete but well-formed answers.
 */
async function requestBatchResilient(
	batch: Job[],
	locale: string,
	client: Client,
): Promise<Map<string, string>> {
	const merged = new Map<string, string>();
	let pending = batch;
	for (let attempt = 0; attempt < 3 && pending.length > 0; attempt += 1) {
		if (attempt > 0) client.tally.retries += 1;
		try {
			const translations = await withRetry(
				() => requestBatch(pending, locale, client),
				{
					onRetry: (n, delay) => {
						client.tally.retries += 1;
						console.log(
							`    ${locale}: retry ${n} in ${delay}ms (transport/rate limit)`,
						);
					},
				},
			);
			for (const [id, text] of translations) merged.set(id, text);
		} catch (error) {
			if (attempt === 2) throw error;
		}
		pending = pending.filter((job) => {
			const text = merged.get(job.id);
			return typeof text !== "string" || text.length === 0;
		});
	}
	return merged;
}

/* ── string-level route ───────────────────────────────────────────────── */

/**
 * Split large JSON into translatable leaves, translate those, and reassemble
 * locally. The reassembly is what guarantees the structure survives, so the
 * batches of one file can run concurrently without any of them being able to
 * corrupt the others.
 */
async function translateJsonStrings(
	config: ProjectConfig,
	jobs: Job[],
	locale: string,
	client: Client,
	store: TranslationStore,
	run: RunHandle | undefined,
	concurrency: number,
): Promise<number> {
	const ignoredPaths = config.validation?.ignoreStringPaths ?? [];
	const items: StringItem[] = [];
	const passthrough: Job[] = [];
	for (const job of jobs) {
		const sourceJson = JSON.parse(job.content) as JsonValue;
		const strings = [...flattenStrings(sourceJson)].filter(
			([path, text]) => !isTechnicalString(path, text, ignoredPaths),
		);
		if (strings.length === 0) {
			passthrough.push(job);
			continue;
		}
		for (const [path, text] of strings) items.push({ job, path, text });
	}

	let translated = 0;
	for (const job of passthrough) {
		// Nothing in it a human would read: the English bytes are the correct
		// translation, and linking them stops it being requeued forever.
		store.save(job.sourceHash, locale, job.content, job.target);
		translated += 1;
		if (run) {
			recordItem(run, {
				project: config.name,
				locale,
				rel: job.file,
				route: "passthrough",
				chars: job.content.length,
				ms: 0,
				ok: true,
			});
		}
	}
	if (items.length === 0) return translated;

	const idOf = (index: number) => `${items[index].job.id}#s${index}`;
	const stringJobs: Job[] = items.map((item, index) => ({
		...item.job,
		id: idOf(index),
		content: item.text,
		target: "",
		sourceHash: "",
	}));

	const batches = chunks(
		stringJobs,
		STRING_BATCH_ITEMS,
		STRING_MAX_BATCH_CHARS,
	);
	console.log(
		`  ${config.name}/${locale}: ${stringJobs.length} strings in ${batches.length} batches ` +
			`(${Math.min(concurrency, batches.length)} at a time)`,
	);
	let done = 0;
	const results = await pool(batches, concurrency, async (batch) => {
		const answer = await requestBatchResilient(batch, locale, client);
		done += 1;
		console.log(
			`    ${config.name}/${locale} strings ${done}/${batches.length} (${batch.length} items)`,
		);
		return answer;
	});
	const translations = new Map<string, string>();
	for (const result of results) {
		for (const [id, text] of result) translations.set(id, text);
	}

	const byJob = new Map<Job, Array<{ item: StringItem; index: number }>>();
	items.forEach((item, index) => {
		const list = byJob.get(item.job) ?? [];
		list.push({ item, index });
		byJob.set(item.job, list);
	});

	for (const [job, jobItems] of byJob) {
		const clone = JSON.parse(job.content) as JsonValue;
		let keptSource = 0;
		for (const { item, index } of jobItems) {
			const text = translations.get(idOf(index));
			if (typeof text !== "string" || text.length === 0) {
				keptSource += 1;
				continue;
			}
			setPathValue(clone, item.path, text);
		}
		if (keptSource > 0) {
			console.log(
				`    kept ${keptSource} source strings in ${job.file} (model never returned them)`,
			);
		}
		const content = JSON.stringify(clone, null, 2);
		const diff = compareJson(
			JSON.parse(job.content) as JsonValue,
			JSON.parse(content) as JsonValue,
			config.validation,
			locale,
		);
		if (diff.missing.length || diff.extra.length || diff.typeChanged.length) {
			const detail =
				`reassembled JSON failed structure check ` +
				`(missing ${diff.missing.length}, extra ${diff.extra.length}, type ${diff.typeChanged.length})`;
			console.log(`    skipped ${job.file}: ${detail}`);
			client.tally.skipped += 1;
			if (run) {
				recordItem(run, {
					project: config.name,
					locale,
					rel: job.file,
					route: "string-level",
					chars: job.content.length,
					ms: 0,
					ok: false,
					detail,
				});
			}
			continue;
		}
		store.save(job.sourceHash, locale, content, job.target);
		translated += 1;
		if (run) {
			recordItem(run, {
				project: config.name,
				locale,
				rel: job.file,
				route: "string-level",
				chars: job.content.length,
				ms: 0,
				ok: true,
			});
		}
	}
	console.log(
		`  saved ${config.name}/${locale} ${translated}/${jobs.length} string-level files`,
	);
	return translated;
}

/* ── whole-file route ─────────────────────────────────────────────────── */

function saveWholeFile(
	config: ProjectConfig,
	job: Job,
	content: string,
	locale: string,
	store: TranslationStore,
	client: Client,
	run: RunHandle | undefined,
	ms: number,
): boolean {
	if (job.type === "json") {
		let translatedJson: JsonValue;
		try {
			translatedJson = JSON.parse(content) as JsonValue;
		} catch (error) {
			const detail = `model returned invalid JSON (${
				error instanceof Error ? error.message : String(error)
			})`;
			console.log(`    skipped ${job.file}: ${detail}`);
			client.tally.skipped += 1;
			if (run) {
				recordItem(run, {
					project: config.name,
					locale,
					rel: job.file,
					route: "whole-file",
					chars: job.content.length,
					ms,
					ok: false,
					detail,
				});
			}
			return false;
		}
		const diff = compareJson(
			JSON.parse(job.content) as JsonValue,
			translatedJson,
			config.validation,
			locale,
		);
		if (diff.missing.length || diff.extra.length || diff.typeChanged.length) {
			const detail =
				`model changed JSON structure ` +
				`(missing ${diff.missing.length}, extra ${diff.extra.length}, type ${diff.typeChanged.length})`;
			console.log(`    skipped ${job.file}: ${detail}`);
			client.tally.skipped += 1;
			if (run) {
				recordItem(run, {
					project: config.name,
					locale,
					rel: job.file,
					route: "whole-file",
					chars: job.content.length,
					ms,
					ok: false,
					detail,
				});
			}
			return false;
		}
	}
	store.save(job.sourceHash, locale, content, job.target);
	if (run) {
		recordItem(run, {
			project: config.name,
			locale,
			rel: job.file,
			route: "whole-file",
			chars: job.content.length,
			ms,
			ok: true,
		});
	}
	return true;
}

export function emptyTally(): Tally {
	return {
		translated: 0,
		skipped: 0,
		failed: 0,
		requests: 0,
		retries: 0,
		sourceChars: 0,
	};
}

export type TranslateOptions = {
	concurrency?: number;
	run?: RunHandle;
	/** Pre-built queue, when the caller already computed it for the volume table. */
	queue?: Job[];
	/**
	 * Shared across the projects of one invocation. A run spans every project
	 * in the config, so the totals cannot live inside a single project pass.
	 */
	tally?: Tally;
};

export async function translateProject(
	config: ProjectConfig,
	snapshot: ProjectSnapshot,
	store: TranslationStore,
	options: TranslateOptions = {},
): Promise<number> {
	const queue = options.queue ?? buildQueue(config, snapshot, store);
	if (queue.length === 0) return 0;

	const provider = resolveProvider();
	const concurrency = options.concurrency ?? configuredConcurrency();
	const { run } = options;

	const tally = options.tally ?? emptyTally();
	tally.sourceChars += queue.reduce((sum, job) => sum + job.content.length, 0);
	const client: Client = { provider, tally };

	const byLocale = new Map<string, Job[]>();
	for (const job of queue) {
		byLocale.set(job.locale, [...(byLocale.get(job.locale) ?? []), job]);
	}

	console.log(
		`  ${config.name}: ${queue.length} files, ${byLocale.size} locales, ` +
			`${provider.label} ${provider.model}, concurrency ${concurrency}`,
	);

	let translated = 0;

	// String-level work is per-locale and already parallel inside itself, so
	// it runs first and keeps its own progress line; batching it against the
	// whole-file queue would make both progress counters meaningless.
	for (const [locale, jobs] of byLocale) {
		const stringLevel = jobs.filter((job) => routeFor(job) === "string-level");
		if (stringLevel.length === 0) continue;
		translated += await translateJsonStrings(
			config,
			stringLevel,
			locale,
			client,
			store,
			run,
			concurrency,
		);
	}

	// Parallelism is per source file: one file (all its locales) is one
	// pool task, one request. Different files fly concurrently; inside
	// a file there is nothing sequential — the model returns every
	// locale in a single answer.
	const byFile = new Map<string, Job[]>();
	for (const job of queue) {
		if (routeFor(job) !== "whole-file") continue;
		byFile.set(job.file, [...(byFile.get(job.file) ?? []), job]);
	}
	const files = [...byFile.entries()];
	if (files.length > 0) {
		console.log(
			`  ${config.name}: ${files.length} files (${Math.min(concurrency, files.length)} at a time)`,
		);
		let done = 0;
		const answers = await pool(files, concurrency, async ([file, jobs]) => {
			const started = Date.now();
			console.log(`    ${config.name} ${file} → translating (${jobs.length} locales)…`);
			const translations = await withRetry(() => requestFile(jobs, client), {
				onRetry: (n, delay) => {
					tally.retries += 1;
					console.log(
						`    ${file}: retry ${n} in ${delay}ms (transport/rate limit)`,
					);
				},
			});
			done += 1;
			const ms = Date.now() - started;
			console.log(
				`    ${config.name} ${file} done (${ms}ms, ${done}/${files.length})`,
			);
			return { jobs, translations, ms };
		});

		// Writes happen after the network, on one thread, in input order — so
		// a run is reproducible and the index never sees a partial batch.
		for (const answer of answers) {
			for (const job of answer.jobs) {
				const content = answer.translations.get(job.id)?.get(job.locale) as string;
				if (
					saveWholeFile(
						config,
						job,
						content,
						job.locale,
						store,
						client,
						run,
						answer.ms,
					)
				) {
					translated += 1;
				}
			}
		}
	}

	tally.translated += translated;
	return translated;
}

export { buildQueue };
