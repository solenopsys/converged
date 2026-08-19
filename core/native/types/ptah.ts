export type PtahTaskRequest = {
  plugin: string;
  task: Record<string, unknown>;
  inputs?: Record<string, string>;
  outputs?: string[];
};

export interface RuntimePtahService {
  "task.submit"(task: PtahTaskRequest): Promise<{ taskId: number }>;
  analyze(task: PtahTaskRequest): Promise<unknown>;
}
