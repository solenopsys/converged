import { Cron } from 'croner';
import  { type Provider, ProviderState } from "dag-api";

export default class CronProvider implements Provider {
    public readonly id: string;
    public readonly type = 'cron';
    public state = ProviderState.STOPPED;
    
    private jobs = new Map<string, Cron>();
    
    constructor(id: string) {
      this.id = id;
    }
    
  
    async start(): Promise<void> {
      this.state = ProviderState.STARTING;
      this.state = ProviderState.READY;
    }
    
    async stop(): Promise<void> {
      this.state = ProviderState.STOPPING;
      this.jobs.forEach(job => job.stop());
      this.jobs.clear();
      this.state = ProviderState.STOPPED;
    }
    
    async invoke(operation: string, params: any): Promise<any> {
      switch (operation) {
        case 'schedule':
          const job = new Cron(params.expression, params.callback);
          this.jobs.set(params.id, job);
          return { scheduled: true };
          
        case 'unschedule':
          this.jobs.get(params.id)?.stop();
          this.jobs.delete(params.id);
          return { unscheduled: true };
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    }
    
    isReady(): boolean {
      return this.state === ProviderState.READY;
    }
  }