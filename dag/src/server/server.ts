// server.ts
import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import { cors } from '@elysiajs/cors';
import { createDB, migrate } from './database';
import { WorkflowService } from './workflow-service';
import { WebhookService } from './webhook-service';
import { CreateWorkflowSchema, UpdateWorkflowSchema, ExecuteWorkflowSchema, CreateWebhookSchema } from './types';
import providers from "../confs/providers";

const { db, sqlite } = createDB();
await migrate(db);
await providers.init();

const workflowService = new WorkflowService(db);
const webhookService = new WebhookService(db);

export const server = new Elysia()
  .use(cors())
  .use(swagger({ path: '/docs' }))
  
  .group('/api', (app) => 
    app
      .group('/workflows', (app) => 
        app
          .get('/', async () => {
            const workflows = await workflowService.getAll();
            return workflows.map(w => ({ ...w, config: JSON.parse(w.config) }));
          }, { detail: { tags: ['Workflows'] } })
          
          .post('/', async ({ body, set }) => {
            try {
              const result = await workflowService.create(body.name, body.config);
              set.status = 201;
              return result;
            } catch (error) {
              if (error.message.includes('UNIQUE')) {
                set.status = 409;
                return { error: 'Name exists' };
              }
              throw error;
            }
          }, {
            body: CreateWorkflowSchema,
            detail: { tags: ['Workflows'] }
          })
          
          .get('/:id', async ({ params, set }) => {
            const workflow = await workflowService.getById(params.id);
            if (!workflow) {
              set.status = 404;
              return { error: 'Not found' };
            }
            return { ...workflow, config: JSON.parse(workflow.config) };
          }, { detail: { tags: ['Workflows'] } })
          
          .put('/:id', async ({ params, body, set }) => {
            const result = await workflowService.update(params.id, body.name, body.config);
            if (!result) {
              set.status = 404;
              return { error: 'Not found' };
            }
            return result;
          }, {
            body: UpdateWorkflowSchema,
            detail: { tags: ['Workflows'] }
          })
          
          .delete('/:id', async ({ params, set }) => {
            const result = await workflowService.delete(params.id);
            if (result.numDeletedRows === 0) {
              set.status = 404;
              return { error: 'Not found' };
            }
            return { message: 'Deleted' };
          }, { detail: { tags: ['Workflows'] } })
          
          .post('/:id/execute', async ({ params, body }) => {
            return await workflowService.execute(params.id, body.startNode, body.data);
          }, {
            body: ExecuteWorkflowSchema,
            detail: { tags: ['Workflows'] }
          })
          
          .get('/:id/webhooks', async ({ params }) => {
            return await webhookService.getByWorkflowId(params.id);
          }, { detail: { tags: ['Webhooks'] } })
          
          .post('/:id/webhooks', async ({ params, body, set }) => {
            const result = await webhookService.create(params.id, body.url, body.secret);
            set.status = 201;
            return result;
          }, {
            body: CreateWebhookSchema,
            detail: { tags: ['Webhooks'] }
          })
      )
      
      .group('/webhooks', (app) =>
        app
          .get('/', async () => {
            return await webhookService.getAll();
          }, { detail: { tags: ['Webhooks'] } })
          
          .delete('/:id', async ({ params, set }) => {
            const result = await webhookService.delete(params.id);
            if (result.numDeletedRows === 0) {
              set.status = 404;
              return { error: 'Not found' };
            }
            return { message: 'Deleted' };
          }, { detail: { tags: ['Webhooks'] } })
      )
  )
  
  .post('/webhook/:workflowId', async ({ params, body }) => {
    const execution = await workflowService.execute(params.workflowId, 'start', body);
    const webhooks = await workflowService.triggerWebhooks(params.workflowId, body);
    return { execution, webhooks };
  })