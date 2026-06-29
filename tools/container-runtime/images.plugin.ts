import { Elysia } from "elysia";
import { resolveRequestScopeFromRequest } from "../../back/back-core/src/request-context";

type ImagesPluginOptions = {
	servicesBaseUrl: string;
	serviceToken?: string;
	cacheControl?: string;
};

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	const copy = new Uint8Array(bytes.byteLength);
	copy.set(bytes);
	return copy.buffer;
}

export function createRuntimeImagesPlugin(options: ImagesPluginOptions) {
	const imageCacheControl = options.cacheControl || "public, max-age=300";

	return new Elysia({ name: "runtime-images" }).get(
		"/images/*",
		async ({ request, set }) => {
			const pathname = new URL(request.url).pathname;
			const rest = decodeURIComponent(pathname.slice("/images/".length));
			if (!rest || rest.includes("..")) {
				set.status = 400;
				return "Bad request";
			}

			// The scope is injected as a request header at the edge (Traefik scope
			// middleware) or pinned via STORAGE_SCOPE; no Host → scope mapping here.
			const workspace = resolveRequestScopeFromRequest(request);
			if (!workspace) {
				set.status = 421;
				return `Unknown storage: missing storage scope header for host "${new URL(request.url).host}"`;
			}

			const headers: Record<string, string> = {
				workspace,
				scope: workspace,
				...(options.serviceToken
					? { authorization: `Bearer ${options.serviceToken}` }
					: {}),
			};
			const encodedPath = rest
				.split("/")
				.map((segment) => encodeURIComponent(segment))
				.join("/");
			const upstream = await fetch(
				`${options.servicesBaseUrl}/galery/static/${encodedPath}`,
				{ headers },
			).catch(() => null);
			if (!upstream) {
				set.status = 502;
				return "Bad gateway";
			}
			if (!upstream.ok) {
				set.status = upstream.status;
				return await upstream.text();
			}

			return new Response(
				toArrayBuffer(new Uint8Array(await upstream.arrayBuffer())),
				{
					headers: {
						"Content-Type":
							upstream.headers.get("content-type") || "application/octet-stream",
						"Cache-Control": imageCacheControl,
					},
				},
			);
		},
	);
}
