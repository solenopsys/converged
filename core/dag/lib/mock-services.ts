// Mock file universe for the workflow tests (test-only, never bundled into a
// workflow). Implements the contract.md surface of files / modelconvertor /
// millingextractor / printextractor as one CallHandler for the centimanus
// mock harness. Blobs are strings in the shared cache Map (the Valkey
// stand-in); a mock "archive" blob is JSON: { entries: [{ name, data }] }.

type Cache = Map<string, string>;

export type MockFile = {
	id: string;
	name: string;
	fileType: string;
	data: string;
	collectionId?: string;
	owner?: string;
	processId?: string;
};

export type FileUniverse = {
	files: Map<string, MockFile>;
	collections: Map<string, Record<string, unknown>>;
	calls: string[];

	addFile(name: string, data: string): string;

	addArchive(name: string, entries: { name: string; data: string }[]): string;

	failOn(service: string, method: string, message: string): void;
	handler(service: string, method: string, params: any, cache: Cache): unknown;
};

function extension(name: string): string {
	const i = name.lastIndexOf(".");
	return i < 0 ? "" : name.slice(i + 1).toLowerCase();
}

const TYPE_BY_EXT: Record<string, { type: string; mime: string }> = {
	zip: { type: "zip", mime: "application/zip" },
	stl: { type: "stl", mime: "model/stl" },
	step: { type: "step", mime: "model/step" },
	stp: { type: "step", mime: "model/step" },
	obj: { type: "obj", mime: "model/obj" },
	ply: { type: "ply", mime: "model/ply" },
	"3mf": { type: "3mf", mime: "model/3mf" },
	glb: { type: "glb", mime: "model/gltf-binary" },
	gcode: { type: "gcode", mime: "text/x-gcode" },
	txt: { type: "text", mime: "text/plain" },
};

export function createFileUniverse(): FileUniverse {
	let seq = 0;
	const nextId = (prefix: string) => `${prefix}-${++seq}`;
	const failures = new Map<string, string>();

	const universe: FileUniverse = {
		files: new Map(),
		collections: new Map(),
		calls: [],

		addFile(name, data) {
			const id = nextId("file");
			universe.files.set(id, { id, name, fileType: TYPE_BY_EXT[extension(name)]?.mime ?? "application/octet-stream", data });
			return id;
		},

		addArchive(name, entries) {
			const id = nextId("file");
			universe.files.set(id, {
				id,
				name,
				fileType: "application/zip",
				data: JSON.stringify({ entries }),
			});
			return id;
		},

		failOn(service, method, message) {
			failures.set(`${service}.${method}`, message);
		},

		handler(service, method, params, cache) {
			universe.calls.push(`${service}.${method}`);
			const failure = failures.get(`${service}.${method}`);
			if (failure) throw new Error(failure);

			if (service === "files") return filesHandler(universe, method, params, cache, nextId);
			if (service === "modelconvertor" && method === "convert") {
				const { sourceRef, sourceName } = params.input;
				const blob = readBlob(cache, sourceRef.cacheKey);
				const outName = `${sourceName.replace(/\.[^.]+$/, "")}.glb`;
				const outKey = `blob:convert:${outName}`;
				cache.set(outKey, `glb(${blob})`);
				return { files: [{ name: outName, ref: { cacheKey: outKey } }] };
			}
			if (service === "ptah" && method === "analyze") {
				// ptah reads model bytes from Valkey by ref (inputs field->cacheKey)
				// and writes any produced file back as a ref (outputs field list).
				const { plugin, inputs, outputs } = params as {
					plugin: string;
					task?: Record<string, unknown>;
					inputs?: Record<string, string>;
					outputs?: string[];
				};
				for (const key of Object.values(inputs ?? {})) readBlob(cache, key);

				let result: Record<string, unknown>;
				if (plugin === "opencamlib") {
					result = { triangles: 1894, passes: 6, points: 348, totalTimeSec: 21.2 };
				} else if (plugin === "curaengine") {
					result = { gcodeBytes: 128, exitCode: 0 };
				} else {
					throw new Error(`unexpected ptah plugin: ${plugin}`);
				}

				const outRefs: Record<string, { cacheKey: string; sizeBytes: number }> = {};
				for (const field of outputs ?? []) {
					const key = `blob:ptah:${plugin}:${field}:${universe.calls.length}`;
					cache.set(key, "G1 X0 Y0");
					outRefs[field] = { cacheKey: key, sizeBytes: 8 };
				}
				return { result, outputs: outRefs };
			}
			throw new Error(`unexpected ${service}.${method}`);
		},
	};

	return universe;
}

function readBlob(cache: Cache, cacheKey: string): string {
	const blob = cache.get(cacheKey);
	if (blob === undefined) throw new Error(`cache blob not found: ${cacheKey}`);
	return blob;
}

function filesHandler(
	universe: FileUniverse,
	method: string,
	params: any,
	cache: Cache,
	nextId: (prefix: string) => string,
): unknown {
	if (method === "materialize") {
		const file = universe.files.get(params.fileId);
		if (!file) throw new Error(`File metadata not found: ${params.fileId}`);
		const cacheKey = `blob:${file.id}`;
		cache.set(cacheKey, file.data);
		return {
			ref: { cacheKey, sizeBytes: file.data.length },
			metadata: {
				id: file.id,
				name: file.name,
				fileSize: file.data.length,
				fileType: file.fileType,
				status: "uploaded",
				owner: file.owner ?? "test",
				hash: `hash-${file.id}`,
				compression: "none",
				createdAt: "2026-01-01T00:00:00.000Z",
				chunksCount: 1,
			},
		};
	}
	if (method === "detectType") {
		readBlob(cache, params.input.ref.cacheKey);
		const detected = TYPE_BY_EXT[extension(params.input.name)];
		return detected ?? { type: "unknown", mime: "application/octet-stream" };
	}
	if (method === "saveCollection") {
		universe.collections.set(params.collection.id, params.collection);
		return params.collection.id;
	}
	if (method === "unzip") {
		const blob = readBlob(cache, params.input.ref.cacheKey);
		const archive = JSON.parse(blob) as { entries: { name: string; data: string }[] };
		const entries = archive.entries.map((entry) => {
			const id = nextId("file");
			universe.files.set(id, {
				id,
				name: entry.name,
				fileType: TYPE_BY_EXT[extension(entry.name)]?.mime ?? "application/octet-stream",
				data: entry.data,
				collectionId: params.input.collectionId,
				owner: params.input.owner,
				processId: params.input.processId,
			});
			return { fileId: id, name: entry.name };
		});
		return { entries };
	}
	if (method === "persist") {
		const blob = readBlob(cache, params.input.ref.cacheKey);
		const id = nextId("file");
		universe.files.set(id, {
			id,
			name: params.input.name,
			fileType: params.input.fileType,
			data: blob,
			collectionId: params.input.collectionId,
			owner: params.input.owner,
			processId: params.input.processId,
		});
		return {
			id,
			name: params.input.name,
			fileType: params.input.fileType,
			fileSize: blob.length,
			status: "uploaded",
			owner: params.input.owner,
			hash: `hash-${id}`,
			compression: "none",
			createdAt: "2026-01-01T00:00:00.000Z",
			chunksCount: 1,
			collectionId: params.input.collectionId,
		};
	}
	throw new Error(`unexpected files.${method}`);
}
