import { basename } from "node:path";
import { tmpdir } from "node:os";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";
import type {
  ConvertFormat,
  ModelConvertInput,
  ModelConvertorService,
  ModelConvertResult,
} from "g-modelconvertor";

const DEFAULT_FORMAT: ConvertFormat = "glb2";
const CADASSISTANT_TIMEOUT_MS = 10000;

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
): Promise<ModelConvertResult> {
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
): Promise<ModelConvertResult> {
  const { default: assimpFactory } = await import("assimpjs");
  const assimp = await assimpFactory();

  const fileList = new assimp.FileList();
  fileList.AddFile(sourceName, sourceData);

  const result = assimp.ConvertFileList(fileList, format);
  if (!result.IsSuccess() || result.FileCount() === 0) {
    const errorCode =
      typeof result.GetErrorCode === "function"
        ? String(result.GetErrorCode())
        : "Unknown conversion error";
    throw new Error(`assimp conversion failed: ${errorCode}`);
  }

  const files: ModelConvertResult["files"] = [];
  for (let i = 0; i < result.FileCount(); i++) {
    const file = result.GetFile(i);
    files.push({
      name: basename(String(file.GetPath())),
      data: file.GetContent() as Uint8Array,
    });
  }

  return { files };
}

export class ModelConvertorServiceImpl implements ModelConvertorService {
  async convert(input: ModelConvertInput): Promise<ModelConvertResult> {
    const format = resolveFormat(input.format);
    const sourceName = normalizeSourceName(input.sourceName);

    if (isStepSource(sourceName)) {
      const cadassistant = Bun.which("cadassistant");
      if (!cadassistant) {
        throw new Error(
          "STEP conversion requires cadassistant binary in PATH",
        );
      }
      return convertWithCadAssistant(sourceName, input.sourceData, format);
    }

    return convertWithAssimp(sourceName, input.sourceData, format);
  }
}

export default ModelConvertorServiceImpl;
