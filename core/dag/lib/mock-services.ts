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
	requests: Map<string, Record<string, unknown>>;
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
		requests: new Map(),
		calls: [],

		addFile(name, data) {
			const id = nextId("file");
			universe.files.set(id, {
				id,
				name,
				fileType:
					TYPE_BY_EXT[extension(name)]?.mime ?? "application/octet-stream",
				data,
			});
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

			if (service === "files")
				return filesHandler(universe, method, params, cache, nextId);
			if (service === "store")
				return storeHandler(universe, method, params, cache);
			if (service === "requests") {
				if (method === "createRequest") {
					const id = nextId("request");
					universe.requests.set(id, {
						...params.input,
						id,
						files: { ...(params.input.files ?? {}) },
					});
					return id;
				}
				if (method === "getRequestModel") {
					const model = universe.requests.get(params.id);
					if (!model) throw new Error(`Request not found: ${params.id}`);
					return model;
				}
				if (method === "applyRequestUpdate") {
					const model = universe.requests.get(params.id);
					if (!model) throw new Error(`Request not found: ${params.id}`);
					// ms-requests merges files onto the previous model and turns
					// parameters into fields; the mock mirrors just that much.
					const patch = params.patch as {
						files?: Record<string, string>;
						parameters?: { key: string; value: unknown }[];
					};
					const files = {
						...((model.files as Record<string, string>) ?? {}),
						...(patch.files ?? {}),
					};
					const fields = {
						...((model.fields as Record<string, unknown>) ?? {}),
					};
					for (const parameter of patch.parameters ?? []) {
						fields[parameter.key] = parameter.value;
					}
					const next = { ...model, files, fields };
					universe.requests.set(params.id, next);
					return next;
				}
			}
			if (service === "compressors" && method === "unpack") {
				const source = params.input.chunks
					.map((chunk: { ref: { cacheKey: string } }) =>
						readBlob(cache, chunk.ref.cacheKey),
					)
					.join("");
				const archive = JSON.parse(source) as {
					entries: { name: string; data: string }[];
				};
				return {
					entries: archive.entries.map((entry, index) => {
						const cacheKey = `blob:unpack:${universe.calls.length}:${index}`;
						cache.set(cacheKey, entry.data);
						return {
							name: entry.name,
							fileType:
								TYPE_BY_EXT[extension(entry.name)]?.mime ??
								"application/octet-stream",
							hash: `hash:${entry.name}`,
							fileSize: entry.data.length,
							chunks: [
								{
									ref: { cacheKey, sizeBytes: entry.data.length },
									compression: "none",
									originalSize: entry.data.length,
								},
							],
						};
					}),
				};
			}
			if (service === "modelconvertor" && method === "convert") {
				// The real service reads the stored file itself: metadata for the
				// name, chunks for the bytes. Only the id crosses the boundary.
				const { fileId, sourceName } = params.input;
				const file = universe.files.get(fileId);
				if (!file) throw new Error(`File metadata not found: ${fileId}`);
				const blob = file.data;
				const outName = `${String(sourceName ?? file.name).replace(/\.[^.]+$/, "")}.glb`;
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
					result = {
						triangles: 1894,
						passes: 6,
						points: 348,
						totalTimeSec: 21.2,
					};
				} else if (plugin === "curaengine") {
					result = { gcodeBytes: 128, exitCode: 0 };
				} else {
					throw new Error(`unexpected ptah plugin: ${plugin}`);
				}

				const outRefs: Record<string, { cacheKey: string; sizeBytes: number }> =
					{};
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
	if (method === "get") {
		const file = universe.files.get(params.id);
		if (!file) throw new Error(`File metadata not found: ${params.id}`);
		return metadataFor(file);
	}
	if (method === "getChunks") {
		const file = universe.files.get(params.id);
		if (!file) throw new Error(`File metadata not found: ${params.id}`);
		return [{ hash: `hash-${file.id}`, chunkNumber: 0 }];
	}
	if (method === "save") {
		const file = params.file;
		universe.files.set(file.id, {
			id: file.id,
			name: file.name,
			fileType: file.fileType,
			data: "",
			collectionId: file.collectionId,
			owner: file.owner,
			processId: params.processId,
		});
		return file.id;
	}
	if (method === "saveChunk") return params.chunk.hash;
	if (method === "materialize") {
		const file = universe.files.get(params.fileId);
		if (!file) throw new Error(`File metadata not found: ${params.fileId}`);
		const cacheKey = `blob:${file.id}`;
		cache.set(cacheKey, file.data);
		return {
			ref: { cacheKey, sizeBytes: file.data.length },
			metadata: metadataFor(file),
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
		const archive = JSON.parse(blob) as {
			entries: { name: string; data: string }[];
		};
		const entries = archive.entries.map((entry) => {
			const id = nextId("file");
			universe.files.set(id, {
				id,
				name: entry.name,
				fileType:
					TYPE_BY_EXT[extension(entry.name)]?.mime ??
					"application/octet-stream",
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

function metadataFor(file: MockFile) {
	return {
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
		...(file.collectionId ? { collectionId: file.collectionId } : {}),
	};
}

function storeHandler(
	universe: FileUniverse,
	method: string,
	params: any,
	cache: Cache,
): unknown {
	if (method === "getWithMeta") {
		const file = universe.files.get(String(params.hash).replace(/^hash-/, ""));
		if (!file) throw new Error(`Chunk not found: ${params.hash}`);
		const cacheKey = `blob:${file.id}`;
		cache.set(cacheKey, file.data);
		return {
			dataRef: { cacheKey, sizeBytes: file.data.length },
			compression: "none",
			originalSize: file.data.length,
		};
	}
	if (method === "save") {
		readBlob(cache, params.dataRef.cacheKey);
		return `store-${universe.calls.length}`;
	}
	throw new Error(`unexpected store.${method}`);
}
