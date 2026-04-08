import { Cron } from "croner";
import { createDagServiceClient } from "g-dag";

export type CronEntryBase = {
  id: string;
  name: string;
  expression: string;
  provider: string;
  action: string;
  params?: Record<string, any>;
  status: string;
};

export type CronHistoryRecorder = (entry: {
  cronId: string;
  cronName: string;
  provider: string;
  action: string;
  success: boolean;
  message?: string;
}) => void;

export class CronEngine {
  private jobs = new Map<string, Cron>();

  constructor(private recordHistory: CronHistoryRecorder) {}

  schedule(entry: CronEntryBase) {
    this.unschedule(entry.id);
    const expression = entry.expression.trim().replace(/\s+/g, " ");
    try {
      const job = new Cron(expression, () => {
        this.invokeProvider(entry);
      });
      this.jobs.set(entry.id, job);
    } catch (err) {
      console.error(
        `[cron-engine] invalid expression ignored: id=${entry.id} name="${entry.name}" expression="${expression}"`,
        err,
      );
    }
  }

  unschedule(id: string) {
    const job = this.jobs.get(id);
    if (job) {
      job.stop();
      this.jobs.delete(id);
    }
  }

  rescheduleAll(entries: CronEntryBase[]) {
    for (const entry of entries) {
      if (entry.status === "active") {
        this.schedule(entry);
      }
    }
  }

  private async invokeProvider(entry: CronEntryBase) {
    let success = true;
    let message: string | undefined = undefined;

    try {
      if (entry.provider === "log") {
        message = entry.params?.message ?? "";
        const parts = [`[cron-engine] cron fired: id=${entry.id} name="${entry.name}"`];
        if (message) parts.push(`message="${message}"`);
        console.log(parts.join(" "));
      } else if (entry.provider === "dag" && entry.action === "runWorkflow") {
        const port = process.env.PORT ?? process.env.SERVICES_PORT ?? "3000";
        const baseUrl = `http://localhost:${port}/services`;
        const dagClient = createDagServiceClient({ baseUrl });
        const workflowName = entry.params?.workflowName;
        const params = entry.params?.params ?? {};
        if (!workflowName) throw new Error("dag provider: workflowName is required in params");
        for await (const event of dagClient.startExecution(workflowName, params)) {
          if (event.type === "failed") throw new Error(event.error ?? "dag workflow failed");
          if (event.type === "completed") { message = `execution ${event.executionId} completed`; break; }
        }
      }
    } catch (err: any) {
      success = false;
      message = err?.message ?? String(err);
      console.error(`[cron-engine] provider error: id=${entry.id} name="${entry.name}"`, err);
    }

    this.recordHistory({
      cronId: entry.id,
      cronName: entry.name,
      provider: entry.provider,
      action: entry.action,
      success,
      message,
    });
  }
}
