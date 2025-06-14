// src/db/index.ts
import { Database } from "bun:sqlite";
import { Kysely, SqliteDialect, Migrator } from "kysely";

/* Создаём/открываем файл базы данных */
const sqlite = new Database(
	process.env.DATABASE_URL?.replace("file:", "") || "local.db",
	{
		create: true,
	},
);

// Типы для базы данных
export interface DatabaseSchema {
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

// Создаём Kysely instance
export const db = new Kysely<DatabaseSchema>({
	dialect: new SqliteDialect({
		database: sqlite,
	}),
});

// Миграции в коде
const migrations = {
	"2024-01-01T00-00-00_initial-auth-schema": {
		async up(db: Kysely<any>) {
			// Создаём таблицу users
			await db.schema
				.createTable("users")
				.addColumn("id", "text", (col) => col.primaryKey())
				.addColumn("email", "text", (col) => col.notNull().unique())
				.addColumn("name", "text")
				.addColumn("created_at", "text", (col) =>
					col.notNull().defaultTo("CURRENT_TIMESTAMP"),
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
					col.notNull().defaultTo("CURRENT_TIMESTAMP"),
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
					col.notNull().defaultTo("CURRENT_TIMESTAMP"),
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

// Встроенный мигратор Kysely
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
export type NewUser = Omit<DatabaseSchema["users"], "created_at">;
export type NewAuthMethod = Omit<DatabaseSchema["auth_methods"], "created_at">;
export type NewSession = Omit<DatabaseSchema["sessions"], "created_at">;
export type NewPolicy = DatabaseSchema["policies"];
export type NewUserAttributes = DatabaseSchema["user_attributes"];

// Типизированные хелперы для работы с таблицами
export const users = {
	create: (data: NewUser) =>
		db.insertInto("users").values({
			...data,
			id: data.id || crypto.randomUUID(),
		}),

	findById: (id: string) =>
		db.selectFrom("users").selectAll().where("id", "=", id),

	findByEmail: (email: string) =>
		db.selectFrom("users").selectAll().where("email", "=", email),

	list: () => db.selectFrom("users").selectAll().orderBy("created_at", "desc"),
};

export const authMethods = {
	create: (data: NewAuthMethod) =>
		db.insertInto("auth_methods").values({
			...data,
			id: data.id || crypto.randomUUID(),
		}),

	findByUser: (userId: string) =>
		db.selectFrom("auth_methods").selectAll().where("user_id", "=", userId),

	findByIdentifier: (type: string, identifier: string) =>
		db
			.selectFrom("auth_methods")
			.selectAll()
			.where("type", "=", type)
			.where("identifier", "=", identifier),

	delete: (id: string) => db.deleteFrom("auth_methods").where("id", "=", id),
};

export const sessions = {
	create: (data: NewSession) =>
		db.insertInto("sessions").values({
			...data,
			id: data.id || crypto.randomUUID(),
		}),

	findByTokenHash: (tokenHash: string) =>
		db.selectFrom("sessions").selectAll().where("token_hash", "=", tokenHash),

	findByUser: (userId: string) =>
		db.selectFrom("sessions").selectAll().where("user_id", "=", userId),

	delete: (id: string) => db.deleteFrom("sessions").where("id", "=", id),

	deleteExpired: () =>
		db
			.deleteFrom("sessions")
			.where("expires_at", "<", new Date().toISOString()),
};

export const policies = {
	create: (data: NewPolicy) =>
		db.insertInto("policies").values({
			...data,
			id: data.id || crypto.randomUUID(),
		}),

	findByName: (name: string) =>
		db.selectFrom("policies").selectAll().where("name", "=", name),

	list: () => db.selectFrom("policies").selectAll().orderBy("priority", "desc"),

	update: (id: string, data: Partial<NewPolicy>) =>
		db.updateTable("policies").set(data).where("id", "=", id),

	delete: (id: string) => db.deleteFrom("policies").where("id", "=", id),
};

export const userAttributes = {
	create: (data: NewUserAttributes) =>
		db.insertInto("user_attributes").values(data),

	findByUser: (userId: string) =>
		db.selectFrom("user_attributes").selectAll().where("user_id", "=", userId),

	upsert: (data: NewUserAttributes) =>
		db
			.insertInto("user_attributes")
			.values(data)
			.onConflict((oc) => oc.column("user_id").doUpdateSet(data)),

	delete: (userId: string) =>
		db.deleteFrom("user_attributes").where("user_id", "=", userId),
};
