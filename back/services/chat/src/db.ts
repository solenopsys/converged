// db.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator } from "kysely";

/* Создаём/открываем файл   ./chat.db   (путь можно переопределить env-переменной) */
const sqlite = new Database(process.env.DB_SQLITE_PATH ?? "./chat.db", {
	create: true,
});

// Типы для базы данных
export interface DatabaseSchema {
	chat_conversations: {
		id: string;
		created_at: string;
	};
	chat_messages: {
		id: number;
		conversation_id: string;
		role: string;
		content: string;
		model: string | null;
		meta: string | null;
		ts: string;
	};
	chat_raw_events: {
		id: number;
		conversation_id: string;
		event_type: string | null;
		payload: string | null;
		model: string | null;
		received_at: string;
	};
}

// Создаём Kysely instance
export const db = new Kysely<DatabaseSchema>({
	dialect: new SqliteDialect({
		database: sqlite,
	}),
});

// Встроенный мигратор Kysely
import { Migrator } from "kysely";

// Миграции в коде
const migrations = {
	"2024-01-01T00-00-00_initial-schema": {
		async up(db: Kysely<any>) {
			await db.schema
				.createTable("chat_conversations")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("created_at", "text", (col) =>
					col.defaultTo("CURRENT_TIMESTAMP"),
				)
				.execute();

			await db.schema
				.createTable("chat_messages")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("conversation_id", "text", (col) =>
					col.references("chat_conversations.id").notNull(),
				)
				.addColumn("role", "text", (col) => col.notNull())
				.addColumn("content", "text", (col) => col.notNull())
				.addColumn("model", "text")
				.addColumn("meta", "text")
				.addColumn("ts", "text", (col) => col.defaultTo("CURRENT_TIMESTAMP"))
				.execute();

			await db.schema
				.createTable("chat_raw_events")
				.addColumn("id", "integer", (col) => col.primaryKey().autoIncrement())
				.addColumn("conversation_id", "text", (col) =>
					col.references("chat_conversations.id").notNull(),
				)
				.addColumn("event_type", "text")
				.addColumn("payload", "text")
				.addColumn("model", "text")
				.addColumn("received_at", "text", (col) =>
					col.defaultTo("CURRENT_TIMESTAMP"),
				)
				.execute();

			// Создаём индексы для производительности
			await db.schema
				.createIndex("idx_messages_conversation_ts")
				.on("chat_messages")
				.columns(["conversation_id", "ts"])
				.execute();

			await db.schema
				.createIndex("idx_events_conversation_time")
				.on("chat_raw_events")
				.columns(["conversation_id", "received_at"])
				.execute();

			await db.schema
				.createIndex("idx_messages_conversation_id")
				.on("chat_messages")
				.column("conversation_id")
				.execute();
		},

		async down(db: Kysely<any>) {
			await db.schema.dropTable("chat_raw_events").execute();
			await db.schema.dropTable("chat_messages").execute();
			await db.schema.dropTable("chat_conversations").execute();
		},
	},
};

// Используем встроенный мигратор Kysely
const migrator = new Migrator({
	db,
	provider: {
		async getMigrations() {
			return migrations;
		},
	},
});

// Запускаем миграции
const { error, results } = await migrator.migrateToLatest();

if (error) {
	console.error("Migration failed:", error);
	process.exit(1);
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

// Типы для вставки данных
export type NewConversation = Omit<
	DatabaseSchema["chat_conversations"],
	"created_at"
>;
export type NewMessage = Omit<DatabaseSchema["chat_messages"], "id" | "ts">;
export type NewRawEvent = Omit<
	DatabaseSchema["chat_raw_events"],
	"id" | "received_at"
>;

// Типизированные хелперы для работы с таблицами
export const chatConversations = {
	create: (data: NewConversation) =>
		db.insertInto("chat_conversations").values(data),

	findById: (id: string) =>
		db.selectFrom("chat_conversations").selectAll().where("id", "=", id),

	list: () =>
		db
			.selectFrom("chat_conversations")
			.selectAll()
			.orderBy("created_at", "desc"),
};

export const chatMessages = {
	create: (data: NewMessage) => db.insertInto("chat_messages").values(data),

	findByConversation: (conversationId: string) =>
		db
			.selectFrom("chat_messages")
			.selectAll()
			.where("conversation_id", "=", conversationId)
			.orderBy("ts", "asc"),

	findById: (id: number) =>
		db.selectFrom("chat_messages").selectAll().where("id", "=", id),
};

export const chatRawEvents = {
	create: (data: NewRawEvent) => db.insertInto("chat_raw_events").values(data),

	findByConversation: (conversationId: string) =>
		db
			.selectFrom("chat_raw_events")
			.selectAll()
			.where("conversation_id", "=", conversationId)
			.orderBy("received_at", "asc"),
};
