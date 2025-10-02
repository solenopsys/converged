#!/usr/bin/env bun

interface LogEntry {
    timestamp?: number;
    service: string;
    level: string;
    message: string;
    metadata?: Record<string, any>;
  }
  
  class LogGenerator {
    private services = [
      'nginx', 'postgresql', 'redis', 'elasticsearch', 'rabbitmq',
      'auth-service', 'user-service', 'payment-service', 'notification-service',
      'api-gateway', 'file-service', 'analytics-service'
    ];
  
    private levels = ['INFO', 'WARN', 'ERROR', 'DEBUG'];
    private levelWeights = [0.6, 0.2, 0.15, 0.05]; // INFO чаще всего
  
    private messageTemplates = {
      INFO: [
        'Request processed successfully',
        'User login successful',
        'Database connection established',
        'Cache hit for key {}',
        'File uploaded successfully',
        'Email sent to user {}',
        'API request completed in {}ms',
        'Background job started',
        'Service health check passed'
      ],
      WARN: [
        'High memory usage detected: {}%',
        'Database connection pool nearly full',
        'API rate limit approaching for user {}',
        'Cache miss rate high: {}%',
        'Disk space low: {} GB remaining',
        'Long running query detected: {}s',
        'Retry attempt {} for failed operation'
      ],
      ERROR: [
        'Database connection failed',
        'Authentication failed for user {}',
        'File not found: {}',
        'Payment processing failed: {}',
        'Network timeout after {}ms',
        'Invalid JSON payload received',
        'Permission denied for operation',
        'Service unavailable: {}',
        'Memory allocation failed'
      ],
      DEBUG: [
        'SQL query executed: {}',
        'Cache key generated: {}',
        'Function entry: {}',
        'Variable state: {} = {}',
        'HTTP headers: {}',
        'Configuration loaded: {}',
        'Thread pool status: {} active'
      ]
    };
  
    private userIds = Array.from({length: 100}, (_, i) => `user_${1000 + i}`);
    private ipAddresses = Array.from({length: 50}, () => 
      `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`
    );
  
    constructor(private endpoint: string = 'http://localhost:3009/logs') {}
  
    private randomChoice<T>(arr: T[], weights?: number[]): T {
      if (!weights) {
        return arr[Math.floor(Math.random() * arr.length)];
      }
      
      const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
      let random = Math.random() * totalWeight;
      
      for (let i = 0; i < arr.length; i++) {
        random -= weights[i];
        if (random <= 0) {
          return arr[i];
        }
      }
      
      return arr[arr.length - 1];
    }
  
    private formatMessage(template: string): string {
      return template.replace(/{}/g, () => {
        const replacements = [
          Math.floor(Math.random() * 1000).toString(),
          this.randomChoice(this.userIds),
          Math.floor(Math.random() * 5000).toString(),
          Math.floor(Math.random() * 100).toString(),
          `${Math.floor(Math.random() * 100)}.${Math.floor(Math.random() * 100)}`,
          `/api/v1/endpoint/${Math.floor(Math.random() * 100)}`,
          `config_${Math.floor(Math.random() * 10)}`,
          `operation_${Math.floor(Math.random() * 50)}`
        ];
        return this.randomChoice(replacements);
      });
    }
  
    private generateMetadata(service: string, level: string): Record<string, any> {
      const baseMetadata = {
        hostname: `server-${Math.floor(Math.random() * 10) + 1}`,
        pid: Math.floor(Math.random() * 30000) + 1000,
        thread: `thread-${Math.floor(Math.random() * 8) + 1}`
      };
  
      // Добавляем специфичные для сервиса метаданные
      switch (service) {
        case 'nginx':
          return {
            ...baseMetadata,
            method: this.randomChoice(['GET', 'POST', 'PUT', 'DELETE']),
            status: level === 'ERROR' ? this.randomChoice([404, 500, 502, 503]) : this.randomChoice([200, 201, 202]),
            response_time: Math.floor(Math.random() * 2000) + 10,
            ip: this.randomChoice(this.ipAddresses),
            user_agent: 'Mozilla/5.0 (compatible; LogGenerator/1.0)'
          };
        
        case 'postgresql':
          return {
            ...baseMetadata,
            database: this.randomChoice(['users', 'orders', 'products', 'analytics']),
            query_time: Math.random() * 1000,
            rows_affected: Math.floor(Math.random() * 1000)
          };
        
        case 'redis':
          return {
            ...baseMetadata,
            operation: this.randomChoice(['GET', 'SET', 'DEL', 'EXPIRE']),
            key: `cache:${Math.floor(Math.random() * 10000)}`,
            memory_usage: Math.floor(Math.random() * 100)
          };
        
        default:
          return {
            ...baseMetadata,
            user_id: level !== 'DEBUG' ? this.randomChoice(this.userIds) : undefined,
            request_id: `req_${Math.random().toString(36).substr(2, 9)}`,
            session_id: `sess_${Math.random().toString(36).substr(2, 12)}`
          };
      }
    }
  
    generateLog(): LogEntry {
      const service = this.randomChoice(this.services);
      const level = this.randomChoice(this.levels, this.levelWeights);
      const template = this.randomChoice(this.messageTemplates[level as keyof typeof this.messageTemplates]);
      const message = this.formatMessage(template);
      const metadata = this.generateMetadata(service, level);
  
      // Добавляем немного разброса во времени (до 1 минуты назад)
      const timestamp = Date.now() - Math.floor(Math.random() * 60000);
  
      return {
        timestamp,
        service,
        level,
        message,
        metadata
      };
    }
  
    async sendLog(log: LogEntry): Promise<boolean> {
      try {
        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(log)
        });
        
        if (!response.ok) {
          console.error(`Failed to send log: ${response.status} ${response.statusText}`);
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Error sending log:', error.message);
        return false;
      }
    }
  
    async sendBatch(logs: LogEntry[]): Promise<boolean> {
      try {
        const response = await fetch(this.endpoint.replace('/logs', '/logs/batch'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(logs)
        });
        
        if (!response.ok) {
          console.error(`Failed to send batch: ${response.status} ${response.statusText}`);
          return false;
        }
        
        return true;
      } catch (error) {
        console.error('Error sending batch:', error.message);
        return false;
      }
    }
  
    async generateContinuous(options: {
      logsPerSecond?: number;
      duration?: number; // в секундах, 0 = бесконечно
      batchSize?: number;
    } = {}) {
      const {
        logsPerSecond = 10,
        duration = 0,
        batchSize = 1
      } = options;
  
      const interval = 1000 / logsPerSecond;
      let totalSent = 0;
      let errors = 0;
      const startTime = Date.now();
  
      console.log(`🚀 Starting log generation:`);
      console.log(`   Rate: ${logsPerSecond} logs/sec`);
      console.log(`   Batch size: ${batchSize}`);
      console.log(`   Duration: ${duration > 0 ? `${duration}s` : 'infinite'}`);
      console.log(`   Endpoint: ${this.endpoint}`);
      console.log(`   Press Ctrl+C to stop\n`);
  
      const timer = setInterval(async () => {
        const logs = Array.from({ length: batchSize }, () => this.generateLog());
        
        const success = batchSize === 1 
          ? await this.sendLog(logs[0])
          : await this.sendBatch(logs);
        
        if (success) {
          totalSent += batchSize;
          process.stdout.write(`\r✅ Sent: ${totalSent} logs, Errors: ${errors}, Rate: ${(totalSent / ((Date.now() - startTime) / 1000)).toFixed(1)} logs/sec`);
        } else {
          errors++;
          process.stdout.write(`\r❌ Sent: ${totalSent} logs, Errors: ${errors}, Rate: ${(totalSent / ((Date.now() - startTime) / 1000)).toFixed(1)} logs/sec`);
        }
  
        // Проверяем время выполнения
        if (duration > 0 && (Date.now() - startTime) >= duration * 1000) {
          clearInterval(timer);
          console.log(`\n\n🏁 Generation completed!`);
          console.log(`   Total logs sent: ${totalSent}`);
          console.log(`   Errors: ${errors}`);
          console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
          process.exit(0);
        }
      }, interval);
  
      // Graceful shutdown
      process.on('SIGINT', () => {
        clearInterval(timer);
        console.log(`\n\n🛑 Generation stopped by user`);
        console.log(`   Total logs sent: ${totalSent}`);
        console.log(`   Errors: ${errors}`);
        console.log(`   Duration: ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        process.exit(0);
      });
    }
  
    async generateBurst(count: number, concurrent: number = 10) {
      console.log(`🚀 Generating ${count} logs with ${concurrent} concurrent requests...`);
      
      const startTime = Date.now();
      let sent = 0;
      let errors = 0;
  
      const semaphore = new Array(concurrent).fill(null);
      const tasks = Array.from({ length: count }, (_, i) => i);
  
      await Promise.all(semaphore.map(async () => {
        while (tasks.length > 0) {
          const taskId = tasks.shift();
          if (taskId === undefined) break;
  
          const log = this.generateLog();
          const success = await this.sendLog(log);
          
          if (success) {
            sent++;
          } else {
            errors++;
          }
          
          if ((sent + errors) % 100 === 0) {
            process.stdout.write(`\rProgress: ${sent + errors}/${count} (${Math.round((sent + errors) / count * 100)}%)`);
          }
        }
      }));
  
      const duration = (Date.now() - startTime) / 1000;
      console.log(`\n\n🏁 Burst completed!`);
      console.log(`   Logs sent: ${sent}`);
      console.log(`   Errors: ${errors}`);
      console.log(`   Duration: ${duration.toFixed(1)}s`);
      console.log(`   Rate: ${(sent / duration).toFixed(1)} logs/sec`);
    }
  }
  
  // CLI интерфейс
  async function main() {
    const args = process.argv.slice(2);
    const endpoint = process.env.LOG_ENDPOINT || 'http://localhost:3009/logs';
    
    const generator = new LogGenerator(endpoint);
  
    if (args.length === 0) {
      console.log(`📝 Log Generator Usage:
      
      bun log-generator.ts continuous [options]  - Continuous generation
      bun log-generator.ts burst <count>         - Generate burst of logs
      bun log-generator.ts single                - Generate single log
      
      Environment variables:
      LOG_ENDPOINT - Target endpoint (default: http://localhost:3009/logs)
      
      Examples:
      bun log-generator.ts continuous --rate 50 --duration 300
      bun log-generator.ts burst 1000
      LOG_ENDPOINT=http://remote:3009/logs bun log-generator.ts continuous
      `);
      process.exit(1);
    }
  
    const command = args[0];
  
    switch (command) {
      case 'single':
        const log = generator.generateLog();
        console.log('Generated log:', JSON.stringify(log, null, 2));
        const success = await generator.sendLog(log);
        console.log(success ? '✅ Log sent successfully' : '❌ Failed to send log');
        break;
  
      case 'continuous':
        const rateIndex = args.indexOf('--rate');
        const durationIndex = args.indexOf('--duration');
        const batchIndex = args.indexOf('--batch');
        
        const rate = rateIndex !== -1 ? parseInt(args[rateIndex + 1]) || 10 : 10;
        const duration = durationIndex !== -1 ? parseInt(args[durationIndex + 1]) || 0 : 0;
        const batchSize = batchIndex !== -1 ? parseInt(args[batchIndex + 1]) || 1 : 1;
        
        await generator.generateContinuous({
          logsPerSecond: rate,
          duration: duration,
          batchSize: batchSize
        });
        break;
  
      case 'burst':
        const count = parseInt(args[1]) || 100;
        const concurrent = parseInt(args[2]) || 10;
        await generator.generateBurst(count, concurrent);
        break;
  
      default:
        console.error(`❌ Unknown command: ${command}`);
        process.exit(1);
    }
  }
  
  if (import.meta.main) {
    main().catch(console.error);
  }
  
  export { LogGenerator };