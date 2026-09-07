import { existsSync } from "node:fs";
import { basename, resolve } from "node:path";
import { buildWorkflow } from "../../../dag/core/build";

export type WorkflowServer = {
	endpoints: Record<string, string>;
	stop(): void;
};

/**
 * Dev equivalent of Ptah's workflow proxy. The source is bundled for every
 * request, so a workflow edit is visible to Centimanus without re-running a
 * registry publication or restarting the native process.
 */
export function startWorkflowServer(
	projectRoot: string,
	childProjectDir: string | undefined,
	scripts: string[],
	port: number,
): WorkflowServer {
	const entries = new Map<string, string>();
	const roots = [childProjectDir, projectRoot].filter(
		(value): value is string => Boolean(value),
	);
	for (const script of scripts) {
		const name = basename(script, ".js");
		for (const root of roots) {
			const entry = resolve(root, "modules/workflows", name, "index.ts");
			if (!existsSync(entry)) continue;
			entries.set(script, entry);
			break;
		}
		if (!entries.has(script)) {
			throw new Error(`[dev] workflow source not found for ${script}`);
		}
	}

	const server = Bun.serve({
		port,
		fetch: async (request) => {
			const script = decodeURIComponent(new URL(request.url).pathname.slice(1));
			const entry = entries.get(script);
			if (!entry) return new Response("not found", { status: 404 });
			try {
				return new Response(await buildWorkflow(entry), {
					headers: { "content-type": "application/javascript" },
				});
			} catch (error) {
				console.error(`[dev] workflow ${script}:`, error);
				return new Response("workflow build failed", { status: 500 });
			}
		},
	});
	const base = `http://127.0.0.1:${server.port}`;
	const endpoints = Object.fromEntries(
		[...entries.keys()].map((script) => [
			script,
			`${base}/${encodeURIComponent(script)}`,
		]),
	);
	console.log(`[dev] workflow registry: ${base} (${entries.size} scripts)`);
	return { endpoints, stop: () => server.stop(true) };
}
