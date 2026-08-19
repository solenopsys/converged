export type HeaderMap = Record<string, string>;

export type RouteContext = {
	request: Request;
	params: Record<string, string>;
	query: Record<string, string | undefined>;
	headers: HeaderMap;
	body?: unknown;
	set: { status?: number; headers: HeaderMap };
};

export type RouteHandler = (context: RouteContext) => unknown | Promise<unknown>;
export type ServerPlugin = (app: ServerApp) => ServerApp | void;

// Structural check instead of `instanceof ServerApp`: plugin chunks are built
// as separate `bun build` outputs (landing/spa/ms plugins are not bundled
// together with server.entry.ts), so a plugin's `ServerApp` and the host
// server's `ServerApp` are distinct class objects at runtime even though they
// come from the same source. `instanceof` would always be false across that
// bundle boundary, so identity is checked by shape instead.
function isServerAppState(value: unknown): value is { state: SharedState } {
	const state = (value as { state?: Partial<SharedState> } | null)?.state;
	return (
		typeof value === "object" &&
		value !== null &&
		Array.isArray(state?.routes) &&
		Array.isArray(state?.webSockets) &&
		Array.isArray(state?.onRequest) &&
		Array.isArray(state?.onAfterHandle) &&
		Array.isArray(state?.onError)
	);
}

export type WebSocketRoute = {
	open?: (socket: any) => void;
	message?: (socket: any, message: unknown) => void;
	close?: (socket: any) => void;
};

type Route = {
	method: string;
	path: string;
	segments: string[];
	handler: RouteHandler;
};

type WebSocketRegistration = {
	path: string;
	segments: string[];
	handlers: WebSocketRoute;
};

type SharedState = {
	routes: Route[];
	webSockets: WebSocketRegistration[];
	onRequest: Array<(context: RouteContext) => unknown | Promise<unknown>>;
	onAfterHandle: Array<(context: RouteContext) => unknown | Promise<unknown>>;
	onError: Array<(context: { error: unknown; path: string; code: string }) => unknown | Promise<unknown>>;
	onStart: Array<() => unknown | Promise<unknown>>;
	onStop: Array<() => unknown | Promise<unknown>>;
	server?: ReturnType<typeof Bun.serve>;
};

export class ServerApp {
	private readonly state: SharedState;

	constructor(
		private readonly prefix = "",
		state?: SharedState,
	) {
		this.state = state ?? {
			routes: [],
			webSockets: [],
			onRequest: [],
			onAfterHandle: [],
			onError: [],
			onStart: [],
			onStop: [],
		};
	}

	use(plugin: ServerPlugin | ServerApp): this {
		if (typeof plugin === "function") {
			plugin(this);
			return this;
		}
		if (isServerAppState(plugin)) {
			this.state.routes.push(...plugin.state.routes);
			this.state.webSockets.push(...plugin.state.webSockets);
			this.state.onRequest.push(...plugin.state.onRequest);
			this.state.onAfterHandle.push(...plugin.state.onAfterHandle);
			this.state.onError.push(...plugin.state.onError);
			return this;
		}
		throw new Error(
			"ServerApp.use() received a value that is neither a plugin function nor a ServerApp instance",
		);
	}

	group(prefix: string, callback: (app: ServerApp) => unknown): this {
		callback(new ServerApp(joinPath(this.prefix, prefix), this.state));
		return this;
	}

	get(path: string, handler: RouteHandler): this {
		return this.route("GET", path, handler);
	}

	post(path: string, handler: RouteHandler): this {
		return this.route("POST", path, handler);
	}

	put(path: string, handler: RouteHandler): this {
		return this.route("PUT", path, handler);
	}

	all(path: string, handler: RouteHandler): this {
		return this.route("*", path, handler);
	}

	ws(path: string, handlers: WebSocketRoute): this {
		const fullPath = joinPath(this.prefix, path);
		this.state.webSockets.push({
			path: fullPath,
			segments: splitPath(fullPath),
			handlers,
		});
		return this;
	}

	onRequest(handler: (context: RouteContext) => unknown | Promise<unknown>): this {
		this.state.onRequest.push(handler);
		return this;
	}

	onAfterHandle(handler: (context: RouteContext) => unknown | Promise<unknown>): this {
		this.state.onAfterHandle.push(handler);
		return this;
	}

	onError(handler: (context: { error: unknown; path: string; code: string }) => unknown | Promise<unknown>): this {
		this.state.onError.push(handler);
		return this;
	}

	onStart(handler: () => unknown | Promise<unknown>): this {
		this.state.onStart.push(handler);
		return this;
	}

	onStop(handler: () => unknown | Promise<unknown>): this {
		this.state.onStop.push(handler);
		return this;
	}

	listen(options: { port: number; hostname?: string }, callback?: () => void): ReturnType<typeof Bun.serve> {
		if (this.state.server) throw new Error("ServerApp is already listening");
		const app = this;
		this.state.server = Bun.serve({
			port: options.port,
			hostname: options.hostname,
			fetch(request, server) {
				return app.handle(request, server);
			},
			websocket: {
				open(socket) {
					(socket.data as WebSocketRegistration | undefined)?.handlers.open?.(socket);
				},
				message(socket, message) {
					(socket.data as WebSocketRegistration | undefined)?.handlers.message?.(socket, message);
				},
				close(socket) {
					(socket.data as WebSocketRegistration | undefined)?.handlers.close?.(socket);
				},
			},
		});
		for (const hook of this.state.onStart) {
			Promise.resolve(hook()).catch((error) => {
				console.error("[server-app] onStart hook failed", error);
			});
		}
		callback?.();
		return this.state.server;
	}

	stop(): void {
		this.state.server?.stop(true);
		this.state.server = undefined;
		for (const hook of this.state.onStop) {
			Promise.resolve(hook()).catch((error) => {
				console.error("[server-app] onStop hook failed", error);
			});
		}
	}

	private route(method: string, path: string, handler: RouteHandler): this {
		const fullPath = joinPath(this.prefix, path);
		this.state.routes.push({ method, path: fullPath, segments: splitPath(fullPath), handler });
		return this;
	}


	async handle(request: Request, server?: ReturnType<typeof Bun.serve>): Promise<Response | undefined> {
		const url = new URL(request.url);
		const path = url.pathname;
		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers: {
					"Access-Control-Allow-Origin": "*",
					"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Storage-Scope, Workspace, Scope",
					"Access-Control-Allow-Methods": "GET, POST, PUT, OPTIONS",
				},
			});
		}
		const websocket = this.state.webSockets.find((route) => matchPath(route.segments, path) !== null);
		if (websocket && request.headers.get("upgrade")?.toLowerCase() === "websocket") {
			if (!server) return new Response("WebSocket upgrade requires a listening server", { status: 400 });
			return server.upgrade(request, { data: { ...websocket, headers: headersFromRequest(request) } }) ? undefined : new Response("WebSocket upgrade failed", { status: 400 });
		}

		const route = this.state.routes.find((candidate) =>
			(candidate.method === "*" || candidate.method === request.method) &&
			matchPath(candidate.segments, path) !== null,
		);
		if (!route) return new Response("Not found", { status: 404 });
		const headers = headersFromRequest(request);
		const context: RouteContext = {
			request,
			params: matchPath(route.segments, path) ?? {},
			query: Object.fromEntries(url.searchParams.entries()),
			headers,
			body: await readRequestBody(request),
			set: { headers: {} },
		};

		try {
			for (const hook of this.state.onRequest) await hook(context);
			const result = await route.handler(context);
			for (const hook of this.state.onAfterHandle) await hook(context);
			return responseFrom(result, context.set);
		} catch (error) {
			for (const hook of this.state.onError) await hook({ error, path, code: "INTERNAL_SERVER_ERROR" });
			return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Internal Server Error" }), {
				status: 500,
				headers: { "Content-Type": "application/json" },
			});
		}
	}
}

function joinPath(prefix: string, path: string): string {
	const joined = `${prefix}/${path}`.replace(/\/{2,}/g, "/");
	return joined.length > 1 && joined.endsWith("/") ? joined.slice(0, -1) : joined;
}

function splitPath(path: string): string[] {
	return path.split("/").filter(Boolean);
}

function matchPath(segments: string[], pathname: string): Record<string, string> | null {
	const parts = splitPath(pathname);
	const params: Record<string, string> = {};
	for (let index = 0; index < segments.length; index++) {
		const segment = segments[index];
		if (segment === "*") {
			params["*"] = decodeURIComponent(parts.slice(index).join("/"));
			return params;
		}
		const part = parts[index];
		if (part === undefined) return null;
		if (segment.startsWith(":")) params[segment.slice(1)] = decodeURIComponent(part);
		else if (segment !== part) return null;
	}
	return parts.length === segments.length ? params : null;
}

function headersFromRequest(request: Request): HeaderMap {
	const headers: HeaderMap = {};
	request.headers.forEach((value, key) => { headers[key] = value; });
	return headers;
}

async function readRequestBody(request: Request): Promise<unknown> {
	if (request.method === "GET" || request.method === "HEAD") return undefined;
	const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
	const body = request.clone();
	if (contentType.includes("application/json")) {
		try {
			return await body.json();
		} catch {
			return undefined;
		}
	}
	if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
		try {
			return Object.fromEntries((await body.formData()).entries());
		} catch {
			return undefined;
		}
	}
	if (contentType.startsWith("text/")) return body.text();
	const bytes = await body.arrayBuffer();
	return bytes.byteLength > 0 ? bytes : undefined;
}


export async function tryServeStatic(
	dir: string,
	pathname: string,
	headers: HeaderMap = {},
): Promise<Response | null> {
	const relative = decodeURIComponent(pathname).replace(/^\/+/, "");
	if (!relative) return null;
	const base = `${dir.replace(/\/+$/, "")}/`;
	const fullPath = new URL(relative, `file://${base}`).pathname;
	if (!fullPath.startsWith(base)) return null;
	const file = Bun.file(fullPath);
	if (!(await file.exists())) return null;
	return new Response(file, { headers });
}

function responseFrom(result: unknown, set: RouteContext["set"]): Response {
	if (result instanceof Response) {
		const headers = new Headers(result.headers);
		for (const [key, value] of Object.entries(set.headers)) headers.set(key, value);
		return new Response(result.body, { status: set.status ?? result.status, headers });
	}
	const headers = new Headers(set.headers);
	if (result === undefined) return new Response(null, { status: set.status ?? 204, headers });
	if (
		typeof result === "string" ||
		result instanceof Uint8Array ||
		result instanceof ArrayBuffer ||
		result instanceof Blob ||
		result instanceof ReadableStream
	) {
		return new Response(result as BodyInit, { status: set.status ?? 200, headers });
	}
	if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
	return new Response(JSON.stringify(result), { status: set.status ?? 200, headers });
}
