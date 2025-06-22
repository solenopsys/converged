// workflow-service.ts
import { Kysely } from 'kysely';
import { DB } from './database';
import { WorkflowLoader } from "../core/workflow-loader";
import { Workflow } from "../core/workflow";
import nodeMap from "../node_map";
import providers from "../confs/providers";

export class WorkflowService {
  constructor(private db: Kysely<DB>) {}

  async getAll() {
    return await this.db.selectFrom('workflows').selectAll().execute();
  }

  async getById(id: number) {
    return await this.db.selectFrom('workflows').selectAll().where('id', '=', id).executeTakeFirst();
  }

  async create(name: string, config: any) {
    return await this.db
      .insertInto('workflows')
      .values({ name, config: JSON.stringify(config), created_at: new Date().toISOString() })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();
  }

  async update(id: number, name: string, config: any) {
    return await this.db
      .updateTable('workflows')
      .set({ name, config: JSON.stringify(config) })
      .where('id', '=', id)
      .returning(['id', 'name'])
      .executeTakeFirst();
  }

  async delete(id: number) {
    return await this.db.deleteFrom('workflows').where('id', '=', id).executeTakeFirst();
  }

  async execute(id: number, startNode: string, data: any) {
    const workflow = await this.getById(id);
    if (!workflow) throw new Error("Workflow not found");

    const config = JSON.parse(workflow.config);
    const loader = new WorkflowLoader(nodeMap);
    const workflowConfig = loader.load(config);
    const workflowInstance = new Workflow(nodeMap, workflowConfig, providers.store);
    
    await workflowInstance.execute(startNode, data);
    return { workflowId: id, startNode, data };
  }

  async triggerWebhooks(workflowId: number, data: any) {
    const webhooks = await this.db
      .selectFrom('webhooks')
      .selectAll()
      .where('workflow_id', '=', workflowId)
      .where('is_active', '=', true)
      .execute();

    const results = [];
    for (const webhook of webhooks) {
      try {
        const response = await fetch(webhook.url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(webhook.secret && { "X-Webhook-Secret": webhook.secret })
          },
          body: JSON.stringify({ workflowId, data, timestamp: new Date().toISOString() })
        });
        results.push({ webhookId: webhook.id, success: response.ok });
      } catch (error) {
        results.push({ webhookId: webhook.id, success: false });
      }
    }
    return results;
  }
}