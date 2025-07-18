import { Elysia } from 'elysia'
import { Database } from 'bun:sqlite'
import { Kysely, SqliteDialect, sql } from 'kysely'

interface ModuleTable {
  name: string
  code: string
  created_at: string
}

interface DB {
  modules: ModuleTable
}

export interface ModuleStoreOptions {
  /** SQLite database file (default: 'modules.db') */
  dbPath?: string
  /** Route prefix (default: '/registry') */
  prefix?: string
  /** Authorization token (default: process.env.MODULE_TOKEN) */
  authToken?: string
}

export const moduleStorePlugin =
  (opts: ModuleStoreOptions = {}) =>
  async (app: Elysia) => {
    const db = new Kysely<DB>({
      dialect: new SqliteDialect({
        database: new Database(opts.dbPath ?? 'modules.db'),
      }),
    })

    await db.schema
      .createTable('modules')
      .ifNotExists()
      .addColumn('name', 'text', (col) => col.primaryKey())
      .addColumn('code', 'text', (col) => col.notNull())
      .addColumn(
        'created_at',
        'text',
        (col) => col.defaultTo(sql`CURRENT_TIMESTAMP`),
      )
      .execute()

    const prefix = opts.prefix ?? '/registry'
    const AUTH_TOKEN = opts.authToken ?? Bun.env.MODULE_TOKEN ?? ''

    return app.group(prefix, (app) =>
      app
        .get('/modules', async () =>
          db.selectFrom('modules').select(['name', 'created_at']).execute(),
        )
        .get('/module/:name', async ({ params }) => {
          const row = await db
            .selectFrom('modules')
            .select('code')
            .where('name', '=', params.name)
            .executeTakeFirst()
          if (!row) return new Response('Not Found', { status: 404 })
          return row.code
        })
        .post('/module', async ({ request, body }) => {
          const auth = request.headers.get('authorization') ?? ''
          if (auth !== `Bearer ${AUTH_TOKEN}`)
            return new Response('Unauthorized', { status: 401 })

          const { name, code } = (body ?? {}) as Record<string, string>
          if (!name || !code) return new Response('Bad Request', { status: 400 })
          if (code.length > 100 * 1024)
            return new Response('Payload Too Large', { status: 413 })
          try {
            await db.insertInto('modules').values({ name, code }).execute()
            return { status: 'ok' }
          } catch {
            return new Response('Conflict', { status: 409 })
          }
        })
        .delete('/module/:name', async ({ params }) => {
          await db.deleteFrom('modules').where('name', '=', params.name).execute()
          return { status: 'deleted' }
        }),
    )
  }

export default moduleStorePlugin
