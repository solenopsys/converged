// db.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator, sql } from "kysely";
import { migrations } from "./migrations";

import type { DatabaseConfig,DatabaseSchema } from "./types";

// Класс для работы с базой данных
export class DatabaseService {
	private db: Kysely<DatabaseSchema>;
	private sqlite: Database;

	constructor(config: DatabaseConfig = {}) {
		const dbPath = config.path ?? process.env.DB_SQLITE_PATH ?? "./chat.db";
		
		this.sqlite = new Database(dbPath, {
			create: true,
		});

		this.db = new Kysely<DatabaseSchema>({
			dialect: new SqliteDialect({
				database: this.sqlite,
			}),
		});
	}

	// Метод для запуска миграций
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

	// Метод для инициализации (опционально с миграциями)
	async initialize(runMigrations = true): Promise<void> {
		if (runMigrations) {
			await this.runMigrations();
		}
	}

	// Геттер для доступа к Kysely instance
	get kysely(): Kysely<DatabaseSchema> {
		return this.db;
	}

	// Метод для закрытия соединения
	async close(): Promise<void> {
		await this.db.destroy();
		this.sqlite.close();
	}

	// Репозитории
	get conversations() {
		return {
			create: (data: NewConversation) =>
				this.db.insertInto("chat_conversations").values(data).execute(),

			findById: (id: string) =>
				this.db
					.selectFrom("chat_conversations")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst(),

			list: () =>
				this.db
					.selectFrom("chat_conversations")
					.selectAll()
					.orderBy("created_at", "desc")
					.execute(),

			delete: (id: string) =>
				this.db
					.deleteFrom("chat_conversations")
					.where("id", "=", id)
					.execute(),
		};
	}

	get messages() {
		return {
			create: (data: NewMessage) =>
				this.db.insertInto("chat_messages").values(data).execute(),

			findByConversation: (conversationId: string) =>
				this.db
					.selectFrom("chat_messages")
					.selectAll()
					.where("conversation_id", "=", conversationId)
					.orderBy("ts", "asc")
					.execute(),

			findById: (id: number) =>
				this.db
					.selectFrom("chat_messages")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst(),

			update: (id: number, data: Partial<NewMessage>) =>
				this.db
					.updateTable("chat_messages")
					.set(data)
					.where("id", "=", id)
					.execute(),

			delete: (id: number) =>
				this.db.deleteFrom("chat_messages").where("id", "=", id).execute(),
		};
	}

	get rawEvents() {
		return {
			create: (data: NewRawEvent) =>
				this.db.insertInto("chat_raw_events").values(data).execute(),

			findByConversation: (conversationId: string) =>
				this.db
					.selectFrom("chat_raw_events")
					.selectAll()
					.where("conversation_id", "=", conversationId)
					.orderBy("received_at", "asc")
					.execute(),

			findById: (id: number) =>
				this.db
					.selectFrom("chat_raw_events")
					.selectAll()
					.where("id", "=", id)
					.executeTakeFirst(),

			deleteByConversation: (conversationId: string) =>
				this.db
					.deleteFrom("chat_raw_events")
					.where("conversation_id", "=", conversationId)
					.execute(),
		};
	}

	// Транзакции
	async transaction<T>(
		callback: (trx: Kysely<DatabaseSchema>) => Promise<T>
	): Promise<T> {
		return this.db.transaction().execute(callback);
	}
}

// Фабричная функция для создания экземпляра
export function createDatabaseService(
	config?: DatabaseConfig
): DatabaseService {
	return new DatabaseService(config);
}
