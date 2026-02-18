import { randomUUID } from "node:crypto";
import { basename, extname, join } from "node:path";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import process from "node:process";

const WORK_ROOT = process.env.WORK_ROOT ?? "/tmp/openscadconvertor";

export type ConvertStepResult = {
  fileName: string;
  fileData: Uint8Array;
  contentType: string;
};

function isStepName(name: string): boolean {
  const ext = extname(name).toLowerCase();
  return ext === ".step" || ext === ".stp";
}

async function runCadAssistant(
  inputPath: string,
  outputPath: string,
): Promise<{ code: number; timedOut: boolean; outputReady: boolean }> {
  const timeoutMs = Number(process.env.CADASSISTANT_TIMEOUT_MS ?? "10000");
  const pollMs = Number(process.env.CADASSISTANT_POLL_MS ?? "20");
  const pollSeconds = Math.max(0.01, pollMs / 1000);

  const proc = Bun.spawn({
    cmd: [
      "bash",
      "-lc",
      `
set -euo pipefail
in="$1"
out="$2"
timeout_ms="$3"
poll_s="$4"

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

  sleep "$poll_s"
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
      String(timeoutMs),
      String(pollSeconds),
    ],
    stdout: "ignore",
    stderr: "ignore",
    env: process.env,
  });

  const code = await proc.exited;
  const outputReady = existsSync(outputPath);
  const timedOut = code === 124;

  return { code, timedOut, outputReady };
}

export async function convertStepToGlb(
  sourceName: string,
  sourceData: Uint8Array,
): Promise<ConvertStepResult> {
  if (!isStepName(sourceName)) {
    throw new Error("Only .step/.stp files are supported");
  }

  const workId = randomUUID();
  const workDir = join(WORK_ROOT, workId);
  const inputName = basename(sourceName);
  const inputPath = join(workDir, inputName);
  const outputBase = basename(inputName, extname(inputName));
  const outputPath = join(workDir, `${outputBase}.glb`);

  await mkdir(workDir, { recursive: true });

  try {
    await writeFile(inputPath, sourceData);

    const result = await runCadAssistant(inputPath, outputPath);
    if (!existsSync(outputPath)) {
      throw new Error(
        `cadassistant conversion failed (exitCode=${result.code}, timedOut=${result.timedOut})`,
      );
    }

    const fileData = new Uint8Array(await readFile(outputPath));
    return {
      fileName: `${outputBase}.glb`,
      fileData,
      contentType: "model/gltf-binary",
    };
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
