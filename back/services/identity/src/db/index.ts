// src/db/auth-db-service.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator, sql } from "kysely";

// Типы для базы данных
export interface AuthDatabaseSchema {
	users: {
		id: string;
		email: string;
		name: string | null;
		created_at: string;
	};
	auth_methods: {
		id: string;
		user_id: string;
		type: string;
		identifier: string;
		credential: string | null;
		created_at: string;
	};
	sessions: {
		id: string;
		user_id: string;
		token_hash: string;
		expires_at: string;
		created_at: string;
	};
	policies: {
		id: string;
		name: string;
		rules: string;
		effect: string;
		priority: number;
	};
	user_attributes: {
		user_id: string;
		attributes: string;
	};
}

// Типы для вставки данных
export type NewUser = Omit<AuthDatabaseSchema["users"], "created_at">;
export type NewAuthMethod = Omit<AuthDatabaseSchema["auth_methods"], "created_at">;
export type NewSession = Omit<AuthDatabaseSchema["sessions"], "created_at">;
export type NewPolicy = AuthDatabaseSchema["policies"];
export type NewUserAttributes = AuthDatabaseSchema["user_attributes"];

// Миграции
const authMigrations = {
	"2024-01-01T00-00-00_initial-auth-schema": {
		async up(db: Kysely<any>) {
			// Создаём таблицу users
			await db.schema
				.createTable("users")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("email", "text", (col) => col.notNull().unique())
				.addColumn("name", "text")
				.addColumn("created_at", "text", (col) =>
					col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
				)
				.execute();

			// Создаём таблицу auth_methods
			await db.schema
				.createTable("auth_methods")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("user_id", "text", (col) =>
					col.references("users.id").onDelete("cascade").notNull(),
				)
				.addColumn("type", "text", (col) => col.notNull())
				.addColumn("identifier", "text", (col) => col.notNull())
				.addColumn("credential", "text")
				.addColumn("created_at", "text", (col) =>
					col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
				)
				.execute();

			// Создаём таблицу sessions
			await db.schema
				.createTable("sessions")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("user_id", "text", (col) =>
					col.references("users.id").onDelete("cascade").notNull(),
				)
				.addColumn("token_hash", "text", (col) => col.notNull().unique())
				.addColumn("expires_at", "text", (col) => col.notNull())
				.addColumn("created_at", "text", (col) =>
					col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
				)
				.execute();

			// Создаём таблицу policies
			await db.schema
				.createTable("policies")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("name", "text", (col) => col.notNull().unique())
				.addColumn("rules", "text", (col) => col.notNull())
				.addColumn("effect", "text", (col) => col.notNull())
				.addColumn("priority", "integer", (col) => col.notNull().defaultTo(0))
				.execute();

			// Создаём таблицу user_attributes
			await db.schema
				.createTable("user_attributes")
				.addColumn("user_id", "text", (col) =>
					col.primaryKey().references("users.id").onDelete("cascade"),
				)
				.addColumn("attributes", "text", (col) => col.notNull())
				.execute();

			// Создаём индексы
			await db.schema
				.createIndex("idx_auth_methods_user_id")
				.on("auth_methods")
				.column("user_id")
				.execute();

			await db.schema
				.createIndex("idx_auth_methods_identifier")
				.on("auth_methods")
				.columns(["type", "identifier"])
				.execute();

			await db.schema
				.createIndex("idx_sessions_user_id")
				.on("sessions")
				.column("user_id")
				.execute();

			await db.schema
				.createIndex("idx_sessions_token_hash")
				.on("sessions")
				.column("token_hash")
				.execute();

			await db.schema
				.createIndex("idx_sessions_expires_at")
				.on("sessions")
				.column("expires_at")
				.execute();
		},

		async down(db: Kysely<any>) {
			await db.schema.dropTable("user_attributes").execute();
			await db.schema.dropTable("policies").execute();
			await db.schema.dropTable("sessions").execute();
			await db.schema.dropTable("auth_methods").execute();
			await db.schema.dropTable("users").execute();
		},
	},
};

// Интерфейс конфигурации
export interface AuthDatabaseConfig {
	path?: string;
	runMigrations?: boolean;
}

// Основной сервис для работы с БД аутентификации
export class AuthDatabaseService {
	private db: Kysely<AuthDatabaseSchema>;
	private sqlite: Database;

	constructor(config: AuthDatabaseConfig = {}) {
		const dbPath = config.path ?? process.env.DATABASE_URL?.replace("file:", "") ?? "./auth.db";
		
		this.sqlite = new Database(dbPath, {
			create: true,
		});

		this.db = new Kysely<AuthDatabaseSchema>({
			dialect: new SqliteDialect({
				database: this.sqlite,
			}),
		});
	}

	// Запуск миграций
	async runMigrations(): Promise<void> {
		const migrator = new Migrator({
			db: this.db,
			provider: {
				async getMigrations() {
					return authMigrations;
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

	// Инициализация
	async initialize(runMigrations = true): Promise<void> {
		if (runMigrations) {
			await this.runMigrations();
		}
	}

	// Закрытие соединения
	async close(): Promise<void> {
		await this.db.destroy();
		this.sqlite.close();
	}

	// Геттер для прямого доступа к Kysely (если нужно)
	get kysely(): Kysely<AuthDatabaseSchema> {
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
				// SQLite doesn't support ON CONFLICT DO UPDATE directly with Kysely
				// So we do it manually
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

	// Транзакции
	async transaction<T>(
		callback: (trx: Kysely<AuthDatabaseSchema>) => Promise<T>
	): Promise<T> {
		return this.db.transaction().execute(callback);
	}

	// Утилиты для очистки
	async cleanup() {
		// Удаляем просроченные сессии
		await this.sessions.deleteExpired();
		
		// Можно добавить другие операции очистки
	}
}

// Фабричная функция
export function createAuthDatabaseService(
	config?: AuthDatabaseConfig
): AuthDatabaseService {
	return new AuthDatabaseService(config);
}

// Опциональный синглтон
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

/* Пример использования:
import { createAuthDatabaseService } from './auth-db-service';

// Создание и инициализация
const authDb = createAuthDatabaseService({ path: './auth.db' });
await authDb.initialize();

// Создание пользователя с транзакцией
const newUser = await authDb.transaction(async (trx) => {
	const user = await trx
		.insertInto("users")
		.values({
			id: crypto.randomUUID(),
			email: "user@example.com",
			name: "John Doe"
		})
		.returningAll()
		.executeTakeFirstOrThrow();

	await trx
		.insertInto("auth_methods")
		.values({
			id: crypto.randomUUID(),
			user_id: user.id,
			type: "password",
			identifier: user.email,
			credential: "hashed_password"
		})
		.execute();

	return user;
});

// Использование репозиториев
const user = await authDb.users.findByEmail("user@example.com");
const sessions = await authDb.sessions.findActiveByUser(user.id);

// Периодическая очистка
setInterval(() => authDb.cleanup(), 60 * 60 * 1000); // каждый час

// Закрытие при завершении
await authDb.close();
*/