// src/services/users/users-db-service.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator, sql } from "kysely";
import { migrations } from "./migrations";
import { type DatabaseSchema , type NewUser, type NewUserAttributes} from "./types";


export interface UsersDatabaseConfig {
	path?: string;
	runMigrations?: boolean;
}

export class UsersDatabaseService {
	private db: Kysely<DatabaseSchema>;
	private sqlite: Database;

	constructor(config: UsersDatabaseConfig = {}) {
		const dbPath = config.path ?? process.env.DATABASE_URL?.replace("file:", "") ?? "./users.db";
		
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

	// Репозиторий пользователей
	get users() {
		return {
			create: async (data: NewUser) => {
				const result = await this.db
					.insertInto("users")
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
					.selectFrom("users")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst(),

			findByEmail: (email: string) =>
				this.db
					.selectFrom("users")
					.selectAll()
					.where("email", "=", email)
					.executeTakeFirst(),

			list: (limit?: number, offset?: number) => {
				let query = this.db
					.selectFrom("users")
					.selectAll()
					.orderBy("created_at", "desc");
				
				if (limit) query = query.limit(limit);
				if (offset) query = query.offset(offset);
				
				return query.execute();
			},

			update: (id: string, data: Partial<Omit<NewUser, "id">>) =>
				this.db
					.updateTable("users")
					.set(data)
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			delete: (id: string) =>
				this.db
					.deleteFrom("users")
					.where("id", "=", id)
					.returningAll()
					.executeTakeFirst(),

			count: () =>
				this.db
					.selectFrom("users")
					.select(this.db.fn.count<number>("id").as("count"))
					.executeTakeFirstOrThrow()
					.then(r => r.count),
		};
	}

	// Репозиторий атрибутов пользователей
	get userAttributes() {
		return {
			create: async (data: NewUserAttributes) => {
				const result = await this.db
					.insertInto("user_attributes")
					.values(data)
					.returningAll()
					.executeTakeFirstOrThrow();
				return result;
			},

			findByUser: (userId: string) =>
				this.db
					.selectFrom("user_attributes")
					.selectAll()
					.where("user_id", "=", userId)
					.executeTakeFirst(),

			upsert: async (data: NewUserAttributes) => {
				const existing = await this.findByUser(data.user_id);
				
				if (existing) {
					return this.db
						.updateTable("user_attributes")
						.set({ attributes: data.attributes })
						.where("user_id", "=", data.user_id)
						.returningAll()
						.executeTakeFirstOrThrow();
				} else {
					return this.db
						.insertInto("user_attributes")
						.values(data)
						.returningAll()
						.executeTakeFirstOrThrow();
				}
			},

			delete: (userId: string) =>
				this.db
					.deleteFrom("user_attributes")
					.where("user_id", "=", userId)
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

export function createUsersDatabaseService(
	config?: UsersDatabaseConfig
): UsersDatabaseService {
	return new UsersDatabaseService(config);
}

let defaultUsersDbInstance: UsersDatabaseService | null = null;

export function getDefaultUsersDatabaseService(
	config?: UsersDatabaseConfig
): UsersDatabaseService {
	if (!defaultUsersDbInstance) {
		defaultUsersDbInstance = new UsersDatabaseService(config);
	}
	return defaultUsersDbInstance;
}

export async function closeDefaultUsersDatabaseService(): Promise<void> {
	if (defaultUsersDbInstance) {
		await defaultUsersDbInstance.close();
		defaultUsersDbInstance = null;
	}
}