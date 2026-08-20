import { basename, resolve } from "node:path";
import { tmpdir } from "node:os";
import type { WebSocketRequestMessage } from "nrpc";
import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
	printJson,
} from "dag-cli/base";
import { cliWebSocketChannel } from "dag-cli/ws";

// Direct estimate against the ptah native hub, no workflow involved. ptah reads
// files by local path (its native contract) and answers over the transport
// server-stream: progress events arrive as chunks, the final chunk carries the
// result. On the same host as ptah (dev) we pass the file's absolute path — no
// Valkey, no temp copy. Two plugins:
//   opencamlib -> CAM/milling estimate (triangles, passes, points, time)
//   curaengine -> 3D-print slice (writes gcode, returns byte count/exit code)

const PTAH_DEADLINE_MS = 180_000;

type PtahProgress = { phase?: string; plugin?: string; model?: string };
type PtahReply = { result?: unknown; outputs?: Record<string, unknown> };

async function analyze(plugin: string, task: Record<string, unknown>): Promise<PtahReply> {
	const stream = cliWebSocketChannel.requestStream({
		kind: "request",
		requestId: crypto.randomUUID(),
		to: { target: "ptah", service: "ptah" },
		method: "analyze",
		codec: "json",
		deadlineMs: PTAH_DEADLINE_MS,
		// stream:true opts into progress chunks (interactive path); the final
		// chunk carries {result, outputs}.
		payload: { plugin, task, stream: true },
	} as WebSocketRequestMessage);

	let result: PtahReply = {};
	for await (const reply of stream) {
		if (reply.kind === "error") {
			const detail =
				(reply.payload &&
				typeof reply.payload === "object" &&
				"error" in reply.payload &&
				typeof reply.payload.error === "string"
					? reply.payload.error
					: undefined) ??
				(typeof reply.error === "string" ? reply.error : reply.error?.message) ??
				reply.errorCode ??
				"ptah analyze failed";
			throw new Error(detail);
		}
		if (reply.fin) {
			result = (reply.payload ?? {}) as PtahReply;
			continue;
		}
		const progress = (reply.payload ?? {}) as PtahProgress;
		if (progress.phase) {
			console.log(`\x1b[2m· ${progress.plugin ?? plugin}: ${progress.phase}\x1b[0m`);
		}
	}
	return result;
}

function requireFile(param: string | undefined, usage: string): string[] {
	const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) throw new Error(usage);
	return parts;
}

const millingHandler: Handler = async (_client, _splitter, param) => {
	const [file, ...rest] = requireFile(param, "Usage: ptah milling <stl> [toolDiameter] [stepover]");
	const stlPath = resolve(file);
	if (!(await Bun.file(stlPath).exists())) throw new Error(`File not found: ${stlPath}`);

	const task: Record<string, unknown> = { stlPath };
	if (rest[0]) task.toolDiameter = Number(rest[0]);
	if (rest[1]) task.stepover = Number(rest[1]);

	const reply = await analyze("opencamlib", task);
	console.log(`\nmilling estimate for ${basename(stlPath)}:`);
	printJson(reply.result ?? reply);
};

const sliceHandler: Handler = async (_client, _splitter, param) => {
	const [file, def] = requireFile(param, "Usage: ptah slice <stl> <definition.def.json>");
	if (!def) throw new Error("Usage: ptah slice <stl> <definition.def.json>");
	const stlPath = resolve(file);
	const definitionPath = resolve(def);
	if (!(await Bun.file(stlPath).exists())) throw new Error(`File not found: ${stlPath}`);
	if (!(await Bun.file(definitionPath).exists())) throw new Error(`File not found: ${definitionPath}`);

	const gcodePath = resolve(tmpdir(), `ptah-${crypto.randomUUID()}.gcode`);
	const reply = await analyze("curaengine", {
		stlPath,
		definitionPath,
		gcodePath,
		modelName: basename(stlPath),
		definitionName: basename(definitionPath),
	});
	console.log(`\nslice result for ${basename(stlPath)} (gcode: ${gcodePath}):`);
	printJson(reply.result ?? reply);
};

class PtahProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"milling",
				{ handler: millingHandler, description: "CAM/milling estimate via opencamlib (param: <stl> [toolDiameter] [stepover])" },
			],
			[
				"slice",
				{ handler: sliceHandler, description: "3D-print slice via curaengine (param: <stl> <definition.def.json>)" },
			],
		]);
	}
}

export default () => new PtahProcessor(null);
