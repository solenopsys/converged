// src/services/access/access-db-service.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator, sql } from "kysely";
import {type DatabaseSchema, type NewPolicy } from "./types";
import { migrations } from "./migrations";

export interface AccessDatabaseConfig {
	path?: string;
	runMigrations?: boolean;
}

export class AccessDatabaseService {
	private db: Kysely<DatabaseSchema>;
	private sqlite: Database;

	constructor(config: AccessDatabaseConfig = {}) {
		const dbPath = config.path ?? process.env.DATABASE_URL?.replace("file:", "") ?? "./access.db";
		
		this.sqlite = new Database(dbPath, {
			create: true,
		});

		this.db = new Kysely<DatabaseSchema>({
			dialect: new SqliteDialect({
				// @ts-ignore
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

	// Репозиторий политик
	get policies() {
		return {
			create: async (data: NewPolicy) => {
				const result = await this.db
					.insertInto("policies")
					.values({
						...data,
						id: data.id || crypto.randomUUID(),
					})
					.returningAll()
					.executeTakeFirstOrThrow();
				return result;
			},

			findById: (id: string) =>
				this.db
					.selectFrom("policies")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst(),

			findByName: (name: string) =>
				this.db
					.selectFrom("policies")
					.selectAll()
					.where("name", "=", name)
					.executeTakeFirst(),

			list: () =>
				this.db
					.selectFrom("policies")
					.selectAll()
					.orderBy("priority", "desc")
					.execute(),

			update: (id: string, data: Partial<NewPolicy>) =>
				this.db
					.updateTable("policies")
					.set(data)
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			delete: (id: string) =>
				this.db
					.deleteFrom("policies")
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),
		};
	}

	async transaction<T>(
		callback: (trx: Kysely<DatabaseSchema>) => Promise<T>
	): Promise<T> {
		return this.db.transaction().execute(callback);
	}
}

export function createAccessDatabaseService(
	config?: AccessDatabaseConfig
): AccessDatabaseService {
	return new AccessDatabaseService(config);
}

let defaultAccessDbInstance: AccessDatabaseService | null = null;

export function getDefaultAccessDatabaseService(
	config?: AccessDatabaseConfig
): AccessDatabaseService {
	if (!defaultAccessDbInstance) {
		defaultAccessDbInstance = new AccessDatabaseService(config);
	}
	return defaultAccessDbInstance;
}

export async function closeDefaultAccessDatabaseService(): Promise<void> {
	if (defaultAccessDbInstance) {
		await defaultAccessDbInstance.close();
		defaultAccessDbInstance = null;
	}
}