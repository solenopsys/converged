import { Elysia } from 'elysia';
import { Query } from './query';
import { Storage } from './storage';

export class HttpServer {
  private app = new Elysia();
  
  constructor(
    private storage: Storage,
    private query: Query
  ) {
    this.setupRoutes();
  }
  
  private setupRoutes() {
    this.app
      .post('/logs', ({ body }) => {
        const logs = Array.isArray(body) ? body : [body];
        logs.forEach(log => {
          this.storage.store({
            timestamp: log.timestamp || Date.now(),
            service: log.service || 'unknown',
            level: log.level || 'INFO',
            message: log.message || '',
            metadata: log.metadata
          });
        });
        return { ok: true };
      })
      .post('/query', ({ body }) => {
        const result = this.query.exec(body.sql);
        return { data: result };
      })
      .get('/errors', ({ query }) => {
        const hours = parseInt(query.hours) || 24;
        const result = this.query.getErrors(hours);
        return { data: result };
      })
      .get('/service/:name', ({ params }) => {
        const result = this.query.getByService(params.name);
        return { data: result };
      });
  }
  
  start(port = 3000) {
    this.app.listen(port);
    console.log(`Server running on :${port}`);
  }
}
