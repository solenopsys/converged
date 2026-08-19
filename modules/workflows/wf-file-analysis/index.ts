// wf-file-analysis — the cascade the chat triggers, flow only. Every uploaded
// file is staged into Valkey and routed: archives expand back into the queue
// (wf-file-unpack's steps), everything else goes through wf-file-analyze's
// steps (GLB preview + CNC/print estimate). A step failure lands in
// report.errors and the flow carries on — no try/catch anywhere (the engine's
// yield must never be caught). Shared steps: dag-file-steps; service methods:
// see ./contract.md.

import {
	ANALYZE_DEFAULTS,
	type AnalyzeOptions,
	analyzeFile,
	type FlowCtx,
	stageFile,
	unpackArchive,
} from "dag-file-steps";

const DEFAULTS = {
	...ANALYZE_DEFAULTS,
	maxArchiveDepth: 2,
};

type Input = {
	fileIds: string[];
	owner?: string;
	processId?: string;
	options?: Partial<typeof DEFAULTS & AnalyzeOptions>;
};

type Item = { fileId: string; role: "input" | "extracted"; depth: number; collectionId?: string };

rt.workflow = (input: Input) => {
	if (!input?.fileIds?.length) throw new Error("file-analysis requires params.fileIds");

	const o = { ...DEFAULTS, ...(input.options ?? {}) };
	const ctx: FlowCtx = {
		owner: input.owner ?? "workflow:file-analysis",
		processId: input.processId ?? __execId ?? "file-analysis",
		errors: [],
		converted: [],
		estimates: [],
	};

	const report = {
		inputs: [] as Record<string, unknown>[],
		extracted: [] as Record<string, unknown>[],
		converted: ctx.converted,
		estimates: ctx.estimates,
		errors: ctx.errors,
		collections: {} as Record<string, string>,
	};

	const queue: Item[] = input.fileIds.map((fileId) => ({ fileId, role: "input" as const, depth: 0 }));

	while (queue.length > 0) {
		const item = queue.shift() as Item;
		const { fileId } = item;

		const staged = stageFile(ctx, fileId, item.collectionId);
		if (!staged) continue;

		(item.role === "input" ? report.inputs : report.extracted).push({
			fileId,
			name: staged.name,
			fileType: staged.mime,
			size: staged.metadata.fileSize,
			detectedType: staged.type,
			role: item.role,
			collectionId: item.collectionId,
		});

		if (staged.type === "zip") {
			if (item.depth >= o.maxArchiveDepth) {
				ctx.errors.push({ stage: "archive", fileId, message: `recursion depth exceeded: ${o.maxArchiveDepth}` });
				continue;
			}
			const unpacked = unpackArchive(ctx, staged);
			if (!unpacked) continue;
			report.collections[fileId] = unpacked.collectionId;
			for (const e of unpacked.entries) {
				queue.push({
					fileId: e.fileId,
					role: "extracted",
					depth: item.depth + 1,
					collectionId: unpacked.collectionId,
				});
			}
			continue;
		}

		analyzeFile(ctx, o as AnalyzeOptions, staged);
	}

	rt.log(
		`file-analysis ${ctx.processId}: inputs=${report.inputs.length} extracted=${report.extracted.length} ` +
			`estimates=${report.estimates.length} errors=${report.errors.length}`,
	);
	return report;
};
