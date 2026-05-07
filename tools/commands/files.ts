import { createHash } from "node:crypto";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "../cli/src/base";
import {
	createFilesServiceClient,
	type FileChunk,
	type FileMetadata,
	type FilesServiceClient,
} from "g-files";
import {
	UploadWorkerCommandType,
	UploadWorkerEventType,
	type UploadWorkerOutgoingMessage,
} from "../../front/libraries/store-workers/src/types";

type FilesCommandClient = {
	files: FilesServiceClient;
	baseUrl: string;
	headers: Record<string, string>;
};

type UploadOptions = {
	path: string;
	owner: string;
	json: boolean;
};

const DEFAULT_OWNER = "cli:files";

function resolveBaseUrl(): string {
	return (
		process.env.SERVICES_URL ||
		process.env.SERVICES_BASE ||
		"http://127.0.0.1:3000/services"
	).replace(/\/+$/, "");
}

function resolveHeaders(): Record<string, string> {
	const token = process.env.SERVICE_TOKEN?.trim();
	return token ? { authorization: `Bearer ${token}` } : {};
}

function parseUploadOptions(param?: string): UploadOptions {
	const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
	let owner = process.env.FILES_OWNER?.trim() || DEFAULT_OWNER;
	let json = false;
	const pathParts: string[] = [];

	for (const part of parts) {
		if (part === "--json") {
			json = true;
			continue;
		}
		if (part.startsWith("--owner=")) {
			owner = part.slice("--owner=".length).trim() || owner;
			continue;
		}
		pathParts.push(part);
	}

	const path = pathParts.join(" ").trim();
	if (!path) {
		throw new Error("Usage: files upload <path> [--owner=name] [--json]");
	}

	return { path, owner, json };
}

function inferFileType(path: string): string {
	const ext = path.split(".").pop()?.toLowerCase();
	switch (ext) {
		case "txt":
			return "text/plain";
		case "json":
			return "application/json";
		case "pdf":
			return "application/pdf";
		case "zip":
			return "application/zip";
		case "stl":
			return "model/stl";
		case "step":
		case "stp":
			return "model/step";
		case "obj":
			return "model/obj";
		case "ply":
			return "model/ply";
		case "3mf":
			return "model/3mf";
		case "dxf":
			return "image/vnd.dxf";
		case "dwg":
			return "image/vnd.dwg";
		default:
			return "application/octet-stream";
	}
}

function hashBytes(bytes: Uint8Array): string {
	return createHash("sha256").update(bytes).digest("hex");
}

function workerUrl(): URL {
	const here = dirname(fileURLToPath(import.meta.url));
	return pathToFileURL(
		resolve(here, "../../front/libraries/store-workers/dist/store.worker.js"),
	);
}

function readWorkerMessage(event: MessageEvent | { data?: unknown }): UploadWorkerOutgoingMessage {
	return (event as any).data ?? event;
}

async function uploadFile(
	client: FilesCommandClient,
	options: UploadOptions,
): Promise<{ metadata: FileMetadata; chunks: FileChunk[] }> {
	const absolutePath = resolve(options.path);
	const source = Bun.file(absolutePath);
	if (!(await source.exists())) {
		throw new Error(`File not found: ${absolutePath}`);
	}

	const bytes = new Uint8Array(await source.arrayBuffer());
	const fileName = basename(absolutePath);
	const fileType = inferFileType(fileName);
	const file = new File([bytes], fileName, { type: fileType });
	const fileId = crypto.randomUUID();
	const createdAt = new Date().toISOString();
	const metadata: FileMetadata = {
		id: fileId,
		hash: hashBytes(bytes),
		status: "uploading",
		name: fileName,
		fileSize: bytes.length,
		fileType,
		compression: "deflate",
		owner: options.owner,
		createdAt,
		chunksCount: 0,
	};

	await client.files.save(metadata);

	const savedChunks: FileChunk[] = [];
	const chunkSaves = new Set<Promise<void>>();
	const worker = new Worker(workerUrl(), { type: "module" });

	return await new Promise((resolveUpload, rejectUpload) => {
		let settled = false;
		let lastPercent = -1;

		const cleanup = () => {
			try {
				worker.terminate();
			} catch {
				// ignore worker shutdown errors
			}
		};

		const fail = (error: unknown) => {
			if (settled) return;
			settled = true;
			cleanup();
			rejectUpload(error instanceof Error ? error : new Error(String(error)));
		};

		const saveChunk = (message: Extract<UploadWorkerOutgoingMessage, { type: UploadWorkerEventType.ChunkReady }>) => {
			const chunk: FileChunk = {
				fileId,
				hash: message.hash,
				chunkNumber: message.chunkNumber,
				chunkSize: message.chunkSize,
				createdAt,
			};
			const task = client.files
				.saveChunk(chunk)
				.then(() => {
					savedChunks.push(chunk);
				})
				.catch(fail)
				.finally(() => {
					chunkSaves.delete(task);
				});
			chunkSaves.add(task);
		};

		worker.addEventListener("message", (event) => {
			const message = readWorkerMessage(event);
			switch (message.type) {
				case UploadWorkerEventType.Progress: {
					if (options.json || message.totalBytes <= 0) break;
					const percent = Math.floor((message.bytesProcessed / message.totalBytes) * 100);
					if (percent !== lastPercent && (percent === 100 || percent - lastPercent >= 5)) {
						lastPercent = percent;
						process.stdout.write(`\rUploading ${fileName}: ${percent}%`);
					}
					break;
				}
				case UploadWorkerEventType.ChunkReady:
					saveChunk(message);
					break;
				case UploadWorkerEventType.FileUploaded:
					void (async () => {
						await Promise.all(chunkSaves);
						const finalMetadata: FileMetadata = {
							...metadata,
							status: "uploaded",
							chunksCount: message.totalChunks,
						};
						await client.files.update(fileId, finalMetadata);
						if (!options.json) process.stdout.write("\n");
						settled = true;
						cleanup();
						resolveUpload({
							metadata: finalMetadata,
							chunks: savedChunks.sort((left, right) => left.chunkNumber - right.chunkNumber),
						});
					})().catch(fail);
					break;
				case UploadWorkerEventType.Error:
					fail(new Error(message.error));
					break;
			}
		});

		worker.addEventListener("error", (event) => {
			fail((event as ErrorEvent).error ?? (event as ErrorEvent).message);
		});

		worker.postMessage({
			type: UploadWorkerCommandType.UploadStart,
			fileId,
			file,
			store: {
				baseUrl: client.baseUrl,
				headers: client.headers,
				owner: options.owner,
			},
		});
	});
}

const uploadHandler: Handler = async (client: FilesCommandClient, _splitter, param) => {
	const options = parseUploadOptions(param);
	const result = await uploadFile(client, options);
	if (options.json) {
		console.log(JSON.stringify(result, null, 2));
		return;
	}

	console.log("File uploaded");
	console.log("-------------");
	console.log(`fileId:      ${result.metadata.id}`);
	console.log(`name:        ${result.metadata.name}`);
	console.log(`size:        ${result.metadata.fileSize}`);
	console.log(`type:        ${result.metadata.fileType}`);
	console.log(`chunks:      ${result.metadata.chunksCount}`);
	console.log(`hash:        ${result.metadata.hash}`);
	console.log("");
	console.log(`Use in workflow params: { "fileIds": ["${result.metadata.id}"] }`);
};

const infoHandler: Handler = async (client: FilesCommandClient, _splitter, param) => {
	if (!param?.trim()) {
		throw new Error("Usage: files info <fileId>");
	}
	printJson(await client.files.get(param.trim()));
};

const chunksHandler: Handler = async (client: FilesCommandClient, _splitter, param) => {
	if (!param?.trim()) {
		throw new Error("Usage: files chunks <fileId>");
	}
	printJson(await client.files.getChunks(param.trim()));
};

const listHandler: Handler = async (client: FilesCommandClient, _splitter, param) => {
	const limit = param ? Number.parseInt(param, 10) : 20;
	printJson(await client.files.list({ key: "", offset: 0, limit: Number.isFinite(limit) ? limit : 20 }));
};

const statHandler: Handler = async (client: FilesCommandClient) => {
	printJson(await client.files.statistic());
};

class FilesProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			["upload", { handler: uploadHandler, description: "Upload local file via store-worker and ms-files metadata" }],
			["info", { handler: infoHandler, description: "Show file metadata by fileId" }],
			["chunks", { handler: chunksHandler, description: "Show file chunks by fileId" }],
			["list", { handler: listHandler, description: "List uploaded files (default: 20)" }],
			["stat", { handler: statHandler, description: "Show files statistics" }],
		]);
	}
}

export default () => {
	const baseUrl = resolveBaseUrl();
	const headers = resolveHeaders();
	const client: FilesCommandClient = {
		baseUrl,
		headers,
		files: createFilesServiceClient({ baseUrl, headers } as any),
	};
	return new FilesProcessor(client);
};
