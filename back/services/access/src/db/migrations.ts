import { Kysely } from "kysely";

export const migrations = {
    "initial-schema": {
        async up(db: Kysely<any>) {

            // Создаём таблицу policies
            await db.schema
                .createTable("policies")
                .addColumn("id", "text", (col) => col.primaryKey())
                .addColumn("name", "text", (col) => col.notNull().unique())
                .addColumn("rules", "text", (col) => col.notNull())
                .addColumn("effect", "text", (col) => col.notNull())
                .addColumn("priority", "integer", (col) => col.notNull().defaultTo(0))
                .execute();
        },

        async down(db: Kysely<any>) {
            await db.schema.dropTable("policies").execute();
        },
    },
};
