

import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";

 
import { requireAuth } from "./middleware/auth.middleware";
import { authController } from "./auth.controller";
import { oauthController } from "./oauth.controller";

interface Options {
	/** JWT secret (default: 'secret') */
	jwtSecret?: string;
}

export const authServicePlugin =
	(opts: Options = {}) =>
	(app: Elysia) =>
		app
			
			/* ─────────── OAuth routes ─────────── */
			.get("/auth/oauth/:provider", oauthController.redirect)
			.get("/auth/oauth/:provider/callback", oauthController.callback)

		 

			/* ─────────── Health check ─────────── */
			.get("/health", () => ({ status: "healthy" }));

export default authServicePlugin;
