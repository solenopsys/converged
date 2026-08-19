import { afterEach, expect, test } from "bun:test";
import { ServerApp } from "./server-app";

let app: ServerApp | undefined;

afterEach(() => {
	app?.stop();
	app = undefined;
});

test("adapts Bun requests to the server plugin route contract", async () => {
	app = new ServerApp()
		.onAfterHandle(({ set }) => {
			set.headers["x-host"] = "server-app";
		})
		.post("/services/:service", ({ body, headers, params }) => ({
			body,
			authorization: headers.authorization,
			service: params.service,
		}))
		.all("/webhooks/:id", ({ params, request, body }) => ({
			id: params.id,
			method: request.method,
			body,
		}));

	const server = app.listen({ port: 0, hostname: "127.0.0.1" });
	const baseUrl = `http://127.0.0.1:${server.port}`;

	const serviceResponse = await fetch(`${baseUrl}/services/auth`, {
		method: "POST",
		headers: {
			Authorization: "Bearer token",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ token: "abc" }),
	});
	expect(serviceResponse.headers.get("x-host")).toBe("server-app");
	expect(await serviceResponse.json()).toEqual({
		body: { token: "abc" },
		authorization: "Bearer token",
		service: "auth",
	});

	const webhookResponse = await fetch(`${baseUrl}/webhooks/provider`, {
		method: "PATCH",
		headers: { "Content-Type": "text/plain" },
		body: "payload",
	});
	expect(await webhookResponse.json()).toEqual({
		id: "provider",
		method: "PATCH",
		body: "payload",
	});
});
