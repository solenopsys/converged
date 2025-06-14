/* auth-service-plugin.ts
   ───────────────────────────────────────────────────────────────
   Elysia **plugin** that adds full JWT‑based auth service:
     • /auth/login, /auth/register, /auth/logout
     • OAuth redirects & callbacks
     • /users/me (profile)
     • ABAC permission check
     • /health

   Usage:
       import { Elysia } from 'elysia'
       import authService from './auth-service-plugin'

       new Elysia()
         .use(authService({ jwtSecret: process.env.JWT_SECRET }))
         .listen(3000)

   All middleware & schema validation preserved.
   ─────────────────────────────────────────────────────────────── */

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

import { authController } from "./controllers/auth.controller";
import { oauthController } from "./controllers/oauth.controller";
import { abacController } from "./controllers/abac.controller";
import { requireAuth } from "./middleware/auth.middleware";

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

			/* ─────────── User routes ─────────── */
			.get("/users/me", authController.getProfile, {
				beforeHandle: requireAuth,
			})

			/* ─────────── ABAC routes ─────────── */
			.post("/access/check", abacController.checkAccess, {
				beforeHandle: requireAuth,
				body: t.Object({
					resource: t.String(),
					action: t.String(),
				}),
			})

			/* ─────────── Health check ─────────── */
			.get("/health", () => ({ status: "healthy" }));

export default authServicePlugin;
