

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

 
import { requireAuth } from "../../../users/middleware/auth.middleware";
import { authController } from "../../../users/auth.controller";
import { oauthController } from "./oauth.controller";

interface Options {
	/** JWT secret (default: 'secret') */
	jwtSecret?: string;
}

export const authServicePlugin =
	(opts: Options = {}) =>
	(app: Elysia) =>
		app
			/* JWT support */
			.use(
				jwt({
					name: "jwt",
					secret: opts.jwtSecret ?? "secret",
				}),
			)

			/* ─────────── Auth routes ─────────── */
			.post("/auth/login", authController.login, {
				body: t.Object({
					email: t.String(),
					password: t.String(),
				}),
			})

			.post("/auth/register", authController.register, {
				body: t.Object({
					email: t.String(),
					password: t.String(),
					name: t.Optional(t.String()),
				}),
			})

			.post("/auth/logout", authController.logout, {
				beforeHandle: requireAuth,
			})

			/* ─────────── OAuth routes ─────────── */
			.get("/auth/oauth/:provider", oauthController.redirect)
			.get("/auth/oauth/:provider/callback", oauthController.callback)

		 

			/* ─────────── Health check ─────────── */
			.get("/health", () => ({ status: "healthy" }));

export default authServicePlugin;
