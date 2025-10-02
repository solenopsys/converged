// Миграции
import { Kysely,  sql } from "kysely";

export const migrations = {
    "2024-01-01T00-00-00_initial-schema": {
        async up(db: Kysely<any>) {
            await db.schema
                .createTable("chat_conversations")
                .addColumn("id", "text", (col) => col.primaryKey())
                .addColumn("created_at", "text", (col) =>
                    col.defaultTo(sql`CURRENT_TIMESTAMP`),
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
                .addColumn("ts", "text", (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`))
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
                    col.defaultTo(sql`CURRENT_TIMESTAMP`),
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
