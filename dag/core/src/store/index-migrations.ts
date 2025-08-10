import { Kysely, sql } from 'kysely'

// Миграция 001: Создание основных таблиц
export async function up001(db: Kysely<any>): Promise<void> {
  // Таблица workflow
  await db.schema
    .createTable('workflow')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('current_version', 'text', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('created_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  // Индексы для workflow
  await db.schema
    .createIndex('idx_workflow_name')
    .on('workflow')
    .column('name')
    .execute()

  await db.schema
    .createIndex('idx_workflow_active')
    .on('workflow')
    .column('is_active')
    .execute()

  // Таблица процессов
  await db.schema
    .createTable('process')
    .addColumn('id', 'text', (col) => col.primaryKey())
    .addColumn('workflow_id', 'text', (col) => col.references('workflow.id').onDelete('set null'))
    .addColumn('status', 'text', (col) => col.notNull().defaultTo('queued'))
    .addColumn('started_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('created_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('meta', 'text') // JSON
    .execute()

  // Индексы для process
  await db.schema
    .createIndex('idx_process_status')
    .on('process')
    .column('status')
    .execute()

  await db.schema
    .createIndex('idx_process_workflow_id')
    .on('process')
    .column('workflow_id')
    .execute()

  await db.schema
    .createIndex('idx_process_started_at')
    .on('process')
    .column('started_at')
    .execute()

  // Таблица узлов
  await db.schema
    .createTable('nodes')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('process_id', 'text', (col) => col.notNull().references('process.id').onDelete('cascade'))
    .addColumn('node_id', 'text', (col) => col.notNull())
    .addColumn('state', 'text', (col) => col.notNull().defaultTo('queued'))
    .addColumn('started_at', 'datetime')
    .addColumn('completed_at', 'datetime')
    .addColumn('error_message', 'text')
    .addColumn('retry_count', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('created_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  // Индексы для nodes
  await db.schema
    .createIndex('idx_nodes_process_id')
    .on('nodes')
    .column('process_id')
    .execute()

  await db.schema
    .createIndex('idx_nodes_state')
    .on('nodes')
    .column('state')
    .execute()

  await db.schema
    .createIndex('idx_nodes_process_node')
    .on('nodes')
    .columns(['process_id', 'node_id'])
    .unique()
    .execute()

  // Таблица webhook
  await db.schema
    .createTable('webhook')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull())
    .addColumn('workflow_id', 'text', (col) => col.notNull().references('workflow.id').onDelete('cascade'))
    .addColumn('url', 'text', (col) => col.notNull())
    .addColumn('method', 'text', (col) => col.notNull().defaultTo('POST'))
    .addColumn('is_active', 'boolean', (col) => col.notNull().defaultTo(true))
    .addColumn('options', 'text') // JSON
    .addColumn('created_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .addColumn('updated_at', 'datetime', (col) => col.notNull().defaultTo(sql`CURRENT_TIMESTAMP`))
    .execute()

  // Индексы для webhook
  await db.schema
    .createIndex('idx_webhook_workflow_id')
    .on('webhook')
    .column('workflow_id')
    .execute()

  await db.schema
    .createIndex('idx_webhook_url')
    .on('webhook')
    .column('url')
    .execute()

  await db.schema
    .createIndex('idx_webhook_active')
    .on('webhook')
    .column('is_active')
    .execute()
}

export async function down001(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('webhook').execute()
  await db.schema.dropTable('nodes').execute()
  await db.schema.dropTable('process').execute()
  await db.schema.dropTable('workflow').execute()
}

// Миграция 002: Добавление триггеров для updated_at
export async function up002(db: Kysely<any>): Promise<void> {
  // Триггеры для автоматического обновления updated_at
  const tables = ['workflow', 'process', 'nodes', 'webhook']
  
  for (const table of tables) {
    await sql`
      CREATE TRIGGER update_${sql.raw(table)}_updated_at 
      AFTER UPDATE ON ${sql.raw(table)}
      FOR EACH ROW 
      BEGIN 
        UPDATE ${sql.raw(table)} SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `.execute(db)
  }
}

export async function down002(db: Kysely<any>): Promise<void> {
  const tables = ['workflow', 'process', 'nodes', 'webhook']
  
  for (const table of tables) {
    await sql`DROP TRIGGER IF EXISTS update_${sql.raw(table)}_updated_at`.execute(db)
  }
}

// Миграция 003: Добавление констрейнтов для статусов
export async function up003(db: Kysely<any>): Promise<void> {
  // Добавляем проверки для статусов процессов
  await sql`
    ALTER TABLE process ADD CONSTRAINT check_process_status 
    CHECK (status IN ('queued', 'running', 'done', 'failed', 'cancelled'))
  `.execute(db)

  // Добавляем проверки для состояний узлов
  await sql`
    ALTER TABLE nodes ADD CONSTRAINT check_node_state 
    CHECK (state IN ('queued', 'running', 'done', 'failed', 'skipped'))
  `.execute(db)

  // Добавляем проверки для HTTP методов
  await sql`
    ALTER TABLE webhook ADD CONSTRAINT check_webhook_method 
    CHECK (method IN ('GET', 'POST', 'PUT', 'DELETE', 'PATCH'))
  `.execute(db)
}

export async function down003(db: Kysely<any>): Promise<void> {
  await sql`ALTER TABLE process DROP CONSTRAINT check_process_status`.execute(db)
  await sql`ALTER TABLE nodes DROP CONSTRAINT check_node_state`.execute(db)
  await sql`ALTER TABLE webhook DROP CONSTRAINT check_webhook_method`.execute(db)
}

// Экспорт всех миграций
export const migrations = {
  '001_initial_tables': { up: up001, down: down001 },
  '002_update_triggers': { up: up002, down: down002 },
  '003_status_constraints': { up: up003, down: down003 },
}