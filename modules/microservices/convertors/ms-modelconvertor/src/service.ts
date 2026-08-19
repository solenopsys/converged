import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, extname, join } from "node:path";
import { CACHE_BLOB_TTL_SECONDS, type CacheAdapter } from "back-core";
import type {
	CacheRef,
	ConvertFormat,
	ModelConvertInput,
	ModelConvertorService,
	ModelConvertResult,
} from "g-modelconvertor";


type BinaryConvertResult = {
	files: { name: string; data: Uint8Array }[];
};

const DEFAULT_FORMAT: ConvertFormat = "glb2";
const CADASSISTANT_TIMEOUT_MS = 10000;
const ASSIMP_TIMEOUT_MS = 30000;
const requireFromHere = createRequire(import.meta.url);

const ASSIMP_WORKER_SCRIPT = `
import { basename, join } from "node:path";

const [assimpModulePath, inputPath, outputDir, sourceName, format] = process.argv.slice(2);
if (!assimpModulePath || !inputPath || !outputDir || !sourceName || !format) {
  throw new Error("usage: assimp-worker <assimpModulePath> <inputPath> <outputDir> <sourceName> <format>");
}

const { default: assimpFactory } = await import(assimpModulePath);
const assimp = await assimpFactory();
const sourceData = await Bun.file(inputPath).bytes();

const fileList = new assimp.FileList();
fileList.AddFile(sourceName, sourceData);

const result = assimp.ConvertFileList(fileList, format);
if (!result.IsSuccess() || result.FileCount() === 0) {
  const errorCode =
    typeof result.GetErrorCode === "function"
      ? String(result.GetErrorCode())
      : "Unknown conversion error";
  throw new Error(\`assimp conversion failed: \${errorCode}\`);
}

const files = [];
for (let i = 0; i < result.FileCount(); i++) {
  const file = result.GetFile(i);
  const name = basename(String(file.GetPath())) || "converted.bin";
  const outputName = \`\${i}-\${name}\`;
  const outputPath = join(outputDir, outputName);
  await Bun.write(outputPath, file.GetContent());
  files.push({ name, path: outputPath });
}

await Bun.write(join(outputDir, "manifest.json"), JSON.stringify({ files }));
`;

function resolveFormat(format: ConvertFormat | undefined): ConvertFormat {
	return format || DEFAULT_FORMAT;
}

function normalizeSourceName(name: string): string {
	const trimmed = name.trim();
	if (trimmed.length === 0) {
		throw new Error("sourceName is required");
	}
	return basename(trimmed);
}

function isStepSource(fileName: string): boolean {
	const ext = extname(fileName).toLowerCase();
	return ext === ".step" || ext === ".stp";
}

function resolveCadAssistantExtension(format: ConvertFormat): string {
	switch (format) {
		case "gltf":
		case "gltf2":
			return "gltf";
		case "glb":
		case "glb2":
			return "glb";
		default:
			throw new Error(
				`cadassistant does not support requested output format: ${format}`,
			);
	}
}

async function convertWithCadAssistant(
	sourceName: string,
	sourceData: Uint8Array,
	format: ConvertFormat,
): Promise<BinaryConvertResult> {
	const outputExt = resolveCadAssistantExtension(format);
	const base = sourceName.replace(/\.[^.]+$/, "");
	const workDir = await mkdtemp(join(tmpdir(), "ms-modelconvertor-"));
	const inputPath = join(workDir, sourceName);
	const outputPath = join(workDir, `${base}.${outputExt}`);

	try {
		await writeFile(inputPath, sourceData);

		const proc = Bun.spawn({
			cmd: [
				"bash",
				"-lc",
				`
set -euo pipefail
in="$1"
out="$2"
timeout_ms="$3"

setsid cadassistant -i "$in" -o "$out" >/dev/null 2>&1 &
pid=$!
start=$(date +%s%3N)

while [ ! -f "$out" ]; do
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid"
    exit $?
  fi

  now=$(date +%s%3N)
  if [ $((now-start)) -ge "$timeout_ms" ]; then
    kill -TERM -- "-$pid" >/dev/null 2>&1 || true
    sleep 0.1
    kill -KILL -- "-$pid" >/dev/null 2>&1 || true
    wait "$pid" >/dev/null 2>&1 || true
    exit 124
  fi

  sleep 0.02
done

kill -TERM -- "-$pid" >/dev/null 2>&1 || true
sleep 0.1
kill -KILL -- "-$pid" >/dev/null 2>&1 || true
wait "$pid" >/dev/null 2>&1 || true
exit 0
        `,
				"--",
				inputPath,
				outputPath,
				String(CADASSISTANT_TIMEOUT_MS),
			],
			stdout: "ignore",
			stderr: "ignore",
		});

		const code = await proc.exited;
		if (code !== 0 || !existsSync(outputPath)) {
			throw new Error(`cadassistant conversion failed with code ${code}`);
		}

		const converted = await readFile(outputPath);
		return {
			files: [
				{
					name: basename(outputPath),
					data: new Uint8Array(converted),
				},
			],
		};
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

async function convertWithAssimp(
	sourceName: string,
	sourceData: Uint8Array,
	format: ConvertFormat,
): Promise<BinaryConvertResult> {
	const assimpModulePath = requireFromHere.resolve("assimpjs");
	const workDir = await mkdtemp(join(tmpdir(), "ms-modelconvertor-assimp-"));
	const inputPath = join(workDir, sourceName);
	const workerPath = join(workDir, "assimp-worker.mjs");
	const manifestPath = join(workDir, "manifest.json");

	try {
		await writeFile(inputPath, sourceData);
		await writeFile(workerPath, ASSIMP_WORKER_SCRIPT);

		const proc = Bun.spawn({
			cmd: [
				process.execPath,
				workerPath,
				assimpModulePath,
				inputPath,
				workDir,
				sourceName,
				format,
			],
			cwd: process.cwd(),
			stdout: "ignore",
			stderr: "pipe",
		});

		let timedOut = false;
		const timeout = setTimeout(() => {
			timedOut = true;
			proc.kill("SIGTERM");
			setTimeout(() => proc.kill("SIGKILL"), 500).unref();
		}, ASSIMP_TIMEOUT_MS);

		const [code, stderr] = await Promise.all([
			proc.exited,
			new Response(proc.stderr).text(),
		]);
		clearTimeout(timeout);

		if (timedOut) {
			throw new Error(
				`assimp conversion timed out after ${ASSIMP_TIMEOUT_MS}ms`,
			);
		}
		if (code !== 0 || !existsSync(manifestPath)) {
			const details = stderr.trim();
			throw new Error(
				`assimp conversion failed with code ${code}${details ? `: ${details}` : ""}`,
			);
		}

		const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
			files?: Array<{ name?: string; path?: string }>;
		};

		const files: BinaryConvertResult["files"] = [];
		for (const file of manifest.files ?? []) {
			if (!file.name || !file.path) continue;
			files.push({
				name: basename(file.name),
				data: new Uint8Array(await readFile(file.path)),
			});
		}
		if (files.length === 0) {
			throw new Error("assimp conversion produced no files");
		}

		return { files };
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}

export class ModelConvertorServiceImpl implements ModelConvertorService {
	private readonly cache?: CacheAdapter;

	constructor(config?: { cache?: CacheAdapter; valkey?: CacheAdapter }) {
		this.cache = config?.cache ?? config?.valkey;
	}

	private requiredCache(): CacheAdapter {
		if (!this.cache) {
			throw new Error("ms-modelconvertor requires the Valkey cache adapter");
		}
		return this.cache;
	}

	private async readRef(ref: CacheRef): Promise<Uint8Array> {
		if (!ref?.cacheKey) {
			throw new Error("sourceRef is missing cacheKey");
		}
		const bytes = await this.requiredCache().getBytes(ref.cacheKey);
		if (!bytes) {
			throw new Error(`Cache blob not found or expired: ${ref.cacheKey}`);
		}
		return bytes;
	}

	private async writeRef(data: Uint8Array, name: string): Promise<CacheRef> {
		const cache = this.requiredCache();
		const cacheKey = cache.buildKey(
			"modelconvertor",
			"out",
			crypto.randomUUID(),
			name,
		);
		await cache.setBytes(cacheKey, data, CACHE_BLOB_TTL_SECONDS);
		return { cacheKey, sizeBytes: data.byteLength };
	}

	async convert(input: ModelConvertInput): Promise<ModelConvertResult> {
		const format = resolveFormat(input.format);
		const sourceName = normalizeSourceName(input.sourceName);
		const sourceData = await this.readRef(input.sourceRef);

		let converted: BinaryConvertResult;
		if (isStepSource(sourceName)) {
			const cadassistant = Bun.which("cadassistant");
			if (!cadassistant) {
				throw new Error("STEP conversion requires cadassistant binary in PATH");
			}
			converted = await convertWithCadAssistant(sourceName, sourceData, format);
		} else {
			converted = await convertWithAssimp(sourceName, sourceData, format);
		}

		const files: ModelConvertResult["files"] = [];
		for (const file of converted.files) {
			files.push({ name: file.name, ref: await this.writeRef(file.data, file.name) });
		}
		return { files };
	}
}

export default ModelConvertorServiceImpl;
