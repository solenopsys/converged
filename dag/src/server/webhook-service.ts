// webhook-service.ts
import { Kysely } from 'kysely';
import { type DB } from './database';

export class WebhookService {
  constructor(private db: Kysely<DB>) {}

  async getByWorkflowId(workflowId: number) {
    return await this.db
      .selectFrom('webhooks')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .execute();
  }

  async getAll() {
    return await this.db
      .selectFrom('webhooks')
      .innerJoin('workflows', 'webhooks.workflow_id', 'workflows.id')
      .select(['webhooks.id', 'webhooks.url', 'webhooks.secret', 'webhooks.is_active', 'workflows.name as workflow_name'])
      .execute();
  }

  async create(workflowId: number, url: string, secret?: string) {
    return await this.db
      .insertInto('webhooks')
      .values({
        workflow_id: workflowId,
        url,
        secret: secret || null,
        created_at: new Date().toISOString(),
        is_active: true,
      })
      .returning(['id', 'workflow_id', 'url'])
      .executeTakeFirstOrThrow();
  }

  async delete(id: number) {
    return await this.db.deleteFrom('webhooks').where('id', '=', id).executeTakeFirst();
  }
}