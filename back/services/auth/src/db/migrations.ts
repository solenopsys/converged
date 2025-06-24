import { Kysely, sql } from "kysely";


export const migrations = {
    "initial-schema": {
        async up(db: Kysely<any>) {
          

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
            await db.schema.dropTable("sessions").execute();
            await db.schema.dropTable("auth_methods").execute();
        },
    },
};
