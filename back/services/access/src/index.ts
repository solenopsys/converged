import { Elysia, t } from "elysia";
import { abacController } from "./controllers/abac.controller";

interface Options {
	/** Optional configuration for the service */
}

export const accessServicePlugin =
	(opts: Options = {}) =>
	(app: Elysia) =>
		app
			/* ─────────── ABAC routes ─────────── */
			.post("/access/check", abacController.checkAccess, {
				body: t.Object({
					userId: t.String(),
					resource: t.String(),
					action: t.String(),
				}),
			})

			/* ─────────── Health check ─────────── */
			.get("/health", () => ({ status: "healthy" }));

export default accessServicePlugin;