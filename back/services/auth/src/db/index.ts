// src/services/auth/auth-db-service.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator, sql } from "kysely";
import { type DatabaseSchema } from "./types";
import { migrations } from "./migrations";
import { NewAuthMethod, NewSession } from "./types";

export interface AuthDatabaseConfig {
	path?: string;
	runMigrations?: boolean;
}

export class AuthDatabaseService {
	private db: Kysely<DatabaseSchema>;
	private sqlite: Database;

	constructor(config: AuthDatabaseConfig = {}) {
		const dbPath = config.path ?? process.env.DATABASE_URL?.replace("file:", "") ?? "./auth.db";
		
		this.sqlite = new Database(dbPath, {
			create: true,
		});

		this.db = new Kysely<DatabaseSchema>({
			dialect: new SqliteDialect({
				database: this.sqlite,
			}),
		});
	}

	async runMigrations(): Promise<void> {
		const migrator = new Migrator({
			db: this.db,
			provider: {
				async getMigrations() {
					return migrations;
				},
			},
		});

		const { error, results } = await migrator.migrateToLatest();

		if (error) {
			console.error("Migration failed:", error);
			throw error;
		}

		if (results) {
			results.forEach((it) => {
				if (it.status === "Success") {
					console.log(`Migration "${it.migrationName}" was executed successfully`);
				} else if (it.status === "Error") {
					console.error(`Migration "${it.migrationName}" failed`);
				}
			});
		}
	}

	async initialize(runMigrations = true): Promise<void> {
		if (runMigrations) {
			await this.runMigrations();
		}
	}

	async close(): Promise<void> {
		await this.db.destroy();
		this.sqlite.close();
	}

	get kysely(): Kysely<DatabaseSchema> {
		return this.db;
	}

	// Репозиторий методов аутентификации
	get authMethods() {
		return {
			create: async (data: NewAuthMethod) => {
				const result = await this.db
					.insertInto("auth_methods")
					.values({
						...data,
						id: data.id || crypto.randomUUID(),
					})
					.returningAll()
					.executeTakeFirstOrThrow();
				return result;
			},

			findByUser: (userId: string) =>
				this.db
					.selectFrom("auth_methods")
					.selectAll()
					.where("user_id", "=", userId)
					.execute(),

			findByIdentifier: (type: string, identifier: string) =>
				this.db
					.selectFrom("auth_methods")
					.selectAll()
					.where("type", "=", type)
					.where("identifier", "=", identifier)
					.executeTakeFirst(),

			update: (id: string, data: Partial<Omit<NewAuthMethod, "id">>) =>
				this.db
					.updateTable("auth_methods")
					.set(data)
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			delete: (id: string) =>
				this.db
					.deleteFrom("auth_methods")
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			deleteByUser: (userId: string) =>
				this.db
					.deleteFrom("auth_methods")
					.where("user_id", "=", userId)
					.execute(),
		};
	}

	// Репозиторий сессий
	get sessions() {
		return {
			create: async (data: NewSession) => {
				const result = await this.db
					.insertInto("sessions")
					.values({
						...data,
						id: data.id || crypto.randomUUID(),
					})
					.returningAll()
					.executeTakeFirstOrThrow();
				return result;
			},

			findByTokenHash: (tokenHash: string) =>
				this.db
					.selectFrom("sessions")
					.selectAll()
					.where("token_hash", "=", tokenHash)
					.executeTakeFirst(),

			findByUser: (userId: string) =>
				this.db
					.selectFrom("sessions")
					.selectAll()
					.where("user_id", "=", userId)
					.execute(),

			findActiveByUser: (userId: string) =>
				this.db
					.selectFrom("sessions")
					.selectAll()
					.where("user_id", "=", userId)
					.where("expires_at", ">", new Date().toISOString())
					.execute(),

			update: (id: string, data: Partial<Omit<NewSession, "id">>) =>
				this.db
					.updateTable("sessions")
					.set(data)
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			delete: (id: string) =>
				this.db
					.deleteFrom("sessions")
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			deleteExpired: () =>
				this.db
					.deleteFrom("sessions")
					.where("expires_at", "<", new Date().toISOString())
					.execute(),

			deleteByUser: (userId: string) =>
				this.db
					.deleteFrom("sessions")
					.where("user_id", "=", userId)
					.execute(),
		};
	}

	async transaction<T>(
		callback: (trx: Kysely<DatabaseSchema>) => Promise<T>
	): Promise<T> {
		return this.db.transaction().execute(callback);
	}

	async cleanup() {
		await this.sessions.deleteExpired();
	}
}

export function createAuthDatabaseService(
	config?: AuthDatabaseConfig
): AuthDatabaseService {
	return new AuthDatabaseService(config);
}

let defaultAuthDbInstance: AuthDatabaseService | null = null;

export function getDefaultAuthDatabaseService(
	config?: AuthDatabaseConfig
): AuthDatabaseService {
	if (!defaultAuthDbInstance) {
		defaultAuthDbInstance = new AuthDatabaseService(config);
	}
	return defaultAuthDbInstance;
}

export async function closeDefaultAuthDatabaseService(): Promise<void> {
	if (defaultAuthDbInstance) {
		await defaultAuthDbInstance.close();
		defaultAuthDbInstance = null;
	}
}