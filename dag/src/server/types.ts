// types.ts
import { z } from 'zod';

export const CreateWorkflowSchema = z.object({
  name: z.string().min(1),
  config: z.any()
});

export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1),
  config: z.any()
});

export const ExecuteWorkflowSchema = z.object({
  startNode: z.string().optional().default("start"),
  data: z.any().optional().default({})
});

export const CreateWebhookSchema = z.object({
  url: z.string().url(),
  secret: z.string().optional()
});

export type CreateWorkflowDto = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowDto = z.infer<typeof UpdateWorkflowSchema>;
export type ExecuteWorkflowDto = z.infer<typeof ExecuteWorkflowSchema>;
export type CreateWebhookDto = z.infer<typeof CreateWebhookSchema>;