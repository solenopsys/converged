import { Kysely, sql } from "kysely";


export const migrations = {
    "initial-schema": {
        async up(db: Kysely<any>) {
            await db.schema
                .createTable("users")
                .addColumn("id", "text", (col) => col.primaryKey())
                .addColumn("email", "text", (col) => col.notNull().unique())
                .addColumn("name", "text")
                .addColumn("created_at", "text", (col) =>
                    col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`),
                )
                .execute();
            await db.schema
                .createTable("user_attributes")
                .addColumn("user_id", "text", (col) =>
                    col.primaryKey().references("users.id").onDelete("cascade"),
                )
                .addColumn("attributes", "text", (col) => col.notNull())
                .execute();
        },

        async down(db: Kysely<any>) {
            await db.schema.dropTable("user_attributes").execute();
            await db.schema.dropTable("users").execute();
        },
    },
};
