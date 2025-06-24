
import { Elysia, t } from "elysia";
import { jwt } from "@elysiajs/jwt";
import { requireAuth } from "../../auth/src/middleware/auth.middleware";
import { getDefaultUsersDatabaseService, UsersDatabaseService } from "./db";
import { authController } from "./auth.controller";

interface Options {
	/** JWT secret (default: 'secret') */
	jwtSecret?: string;
	/** Database service instance */
	dbService?: UsersDatabaseService;
}

export const authServicePlugin =
	(opts: Options = {}) =>
	(app: Elysia) => {
		// Инициализируем базу данных при старте сервиса
		const dbService = opts.dbService || getDefaultUsersDatabaseService();
		
		// Инициализируем БД с миграциями
		dbService.initialize().catch(console.error);

		return app
			/* JWT support */
			.use(
				jwt({
					name: "jwt",
					secret: opts.jwtSecret ?? "secret",
				}),
			)
 
			/* ─────────── User routes ─────────── */
			.get("/users/me", authController.getProfile, {
				beforeHandle: requireAuth,
			})

			.put("/users/me", authController.updateProfile, {
				beforeHandle: requireAuth,
				body: t.Object({
					name: t.Optional(t.String()),
					email: t.Optional(t.String({ format: "email" })),
					attributes: t.Optional(t.Record(t.String(), t.Any()))
				})
			})

			.get("/users/:id", authController.getUserById, {
				beforeHandle: requireAuth,
				params: t.Object({
					id: t.String()
				})
			})

			.get("/users", authController.listUsers, {
				beforeHandle: requireAuth,
				query: t.Object({
					limit: t.Optional(t.String()),
					offset: t.Optional(t.String())
				})
			})

			.post("/users", authController.createUser, {
				beforeHandle: requireAuth,
				body: t.Object({
					name: t.String(),
					email: t.String({ format: "email" }),
					password_hash: t.String(),
					attributes: t.Optional(t.Record(t.String(), t.Any()))
				})
			})

			.delete("/users/:id", authController.deleteUser, {
				beforeHandle: requireAuth,
				params: t.Object({
					id: t.String()
				})
			})

			/* ─────────── Health check ─────────── */
			.get("/health", () => ({ status: "healthy" }))

			/* ─────────── Graceful shutdown ─────────── */
			.onStop(async () => {
				try {
					await dbService.close();
					console.log("Database connection closed");
				} catch (error) {
					console.error("Error closing database:", error);
				}
			});
	};

export default authServicePlugin;