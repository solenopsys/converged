import { beforeEach, describe, expect, it } from "bun:test";
import { KVStore } from "back-core";
import { runWithWorkspaceContext } from "nrpc";
import { ProcessingStoreService } from "./store/processing";

/**
 * The log is not a table, so the narrowing is the key scheme from
 * `access-control.md`: a run is tagged when it is committed, its nodes are read
 * through it, and a listing starts from the tag side. What changes for the
 * console is only that a caller without a token sees an empty log instead of
 * every workflow's arguments and results.
 */
describe("who sees which runs", () => {
	let log: ProcessingStoreService;
	let cache: Map<string, Buffer>;

	const as = <T>(user: string, fn: () => T, tags?: string[]) =>
		runWithWorkspaceContext({ user, accessTags: tags }, fn);

	/** The storage process reduced to a map, plus the cache `commit` reads from. */
	const memoryStore = () => {
		const rows = new Map<string, Buffer>();
		cache = new Map<string, Buffer>();
		const conn = {
			open: () => {},
			kvPut: (_ms: string, _s: string, key: string, value: Buffer) => {
				rows.set(key, value);
			},
			kvPutFromCache: (_ms: string, _s: string, key: string, ref: string) => {
				const value = cache.get(ref);
				if (!value) throw new Error(`cache entry expired: ${ref}`);
				rows.set(key, value);
			},
			kvGet: (_ms: string, _s: string, key: string) => rows.get(key) ?? null,
			kvDelete: (_ms: string, _s: string, key: string) => {
				rows.delete(key);
			},
			kvList: (_ms: string, _s: string, prefix: string) =>
				[...rows.keys()].filter((key) => key.startsWith(prefix)).sort(),
			kvGetRange: (_ms: string, _s: string, prefix: string) =>
				[...rows.entries()]
					.filter(([key]) => key.startsWith(prefix))
					.sort(([left], [right]) => left.localeCompare(right))
					.map(([, value]) => value),
		};
		return new KVStore(conn as any, "rp-dag", "processing", []);
	};

	/** Whatever the runtime left in Valkey, in this store's wire format. */
	const stage = (ref: string, value: unknown) => {
		cache.set(
			ref,
			Buffer.concat([Buffer.from("KVJ0"), Buffer.from(JSON.stringify(value))]),
		);
	};

	beforeEach(() => {
		log = new ProcessingStoreService(memoryStore());
	});

	const run = (actor: string, id: string, startedAt = 1) => {
		stage(`${id}:exec`, { id, workflow: "nightly", status: "done", startedAt });
		stage(`${id}:node`, { seq: 0, name: "start", executionId: id });
		as(actor, () => {
			log.commit(["exec", id], `${id}:exec`);
			log.commit(["node", id, "000000"], `${id}:node`);
		});
	};

	it("shows the log to any authenticated caller and to no anonymous one", () => {
		run("rp-dag", "run-1");
		run("rp-dag", "run-2", 2);

		expect(as("alice", () => log.listExecutions()).map((e) => e.id)).toEqual([
			"run-2",
			"run-1",
		]);
		expect(log.listExecutions()).toEqual([]);
		expect(log.getExecution("run-1")).toBeUndefined();
	});

	it("reads a run's nodes through the run", () => {
		run("rp-dag", "run-1");

		expect(as("alice", () => log.listNodes("run-1"))).toHaveLength(1);
		expect(log.listNodes("run-1")).toEqual([]);
	});

	it("keeps a narrowed run to the team it was opened to", () => {
		run("rp-dag", "run-1");
		log.access.setVisibility("run-1", "private");
		log.access.grant("run-1", "team-ops");

		expect(as("alice", () => log.listExecutions())).toEqual([]);
		expect(
			as("ops", () => log.listExecutions(), ["team-ops"]).map((e) => e.id),
		).toEqual(["run-1"]);
		expect(as("ops", () => log.listNodes("run-1"), ["team-ops"])).toHaveLength(
			1,
		);
	});

	it("does not double a run's tags when a batch is re-sent", () => {
		run("rp-dag", "run-1");
		run("rp-dag", "run-1");

		expect(log.access.tagsOf("run-1").sort()).toEqual([
			"authenticated",
			"u-rp-dag",
		]);
	});

	it("forgets the tags of a pruned run", () => {
		const small = new ProcessingStoreService(memoryStore(), 1);
		stage("run-old:exec", {
			id: "run-old",
			workflow: "w",
			status: "done",
			startedAt: 1,
		});
		stage("run-new:exec", {
			id: "run-new",
			workflow: "w",
			status: "done",
			startedAt: 2,
		});
		as("rp-dag", () => {
			small.commit(["exec", "run-old"], "run-old:exec");
			small.commit(["exec", "run-new"], "run-new:exec");
			// Retention runs on an interval; this drives it directly.
			(small as any).prune();
		});

		expect(small.access.tagsOf("run-old")).toEqual([]);
		expect(as("alice", () => small.listExecutions()).map((e) => e.id)).toEqual([
			"run-new",
		]);
	});
});
