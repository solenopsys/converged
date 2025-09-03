#!/usr/bin/env bun

import { LogGenerator } from './log-generator';

interface TestResult {
  testName: string;
  totalLogs: number;
  duration: number;
  logsPerSecond: number;
  errors: number;
  success: boolean;
}

class PerformanceTest {
  private generator: LogGenerator;
  private results: TestResult[] = [];

  constructor(private endpoint = 'http://localhost:3009') {
    this.generator = new LogGenerator(`${endpoint}/logs`);
  }

  private async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.endpoint}/health`);
      return response.ok;
    } catch {
      return false;
    }
  }

  private async runTest(
    testName: string, 
    testFn: () => Promise<{ sent: number; errors: number; duration: number }>
  ): Promise<TestResult> {
    console.log(`\n🧪 Running test: ${testName}`);
    console.log('━'.repeat(50));
    
    const startTime = Date.now();
    const result = await testFn();
    const totalDuration = (Date.now() - startTime) / 1000;
    
    const testResult: TestResult = {
      testName,
      totalLogs: result.sent,
      duration: totalDuration,
      logsPerSecond: result.sent / totalDuration,
      errors: result.errors,
      success: result.errors === 0
    };

    this.results.push(testResult);
    
    console.log(`✅ Test completed:`);
    console.log(`   Logs sent: ${testResult.totalLogs}`);
    console.log(`   Duration: ${testResult.duration.toFixed(2)}s`);
    console.log(`   Rate: ${testResult.logsPerSecond.toFixed(1)} logs/sec`);
    console.log(`   Errors: ${testResult.errors}`);
    
    return testResult;
  }

  async testSingleRequests(): Promise<TestResult> {
    return this.runTest('Single HTTP Requests', async () => {
      const count = 100;
      let sent = 0;
      let errors = 0;
      
      for (let i = 0; i < count; i++) {
        const log = this.generator.generateLog();
        const success = await this.generator.sendLog(log);
        
        if (success) {
          sent++;
        } else {
          errors++;
        }
        
        if (i % 10 === 0) {
          process.stdout.write(`\r   Progress: ${i + 1}/${count}`);
        }
      }
      
      process.stdout.write(`\r   Progress: ${count}/${count}\n`);
      
      return { sent, errors, duration: 0 };
    });
  }

  async testBatchRequests(): Promise<TestResult> {
    return this.runTest('Batch HTTP Requests', async () => {
      const batches = 10;
      const batchSize = 50;
      let sent = 0;
      let errors = 0;
      
      for (let i = 0; i < batches; i++) {
        const logs = Array.from({ length: batchSize }, () => this.generator.generateLog());
        const success = await this.generator.sendBatch(logs);
        
        if (success) {
          sent += batchSize;
        } else {
          errors += batchSize;
        }
        
        process.stdout.write(`\r   Progress: ${(i + 1) * batchSize}/${batches * batchSize}`);
      }
      
      process.stdout.write(`\n`);
      
      return { sent, errors, duration: 0 };
    });
  }

  async testConcurrentRequests(): Promise<TestResult> {
    return this.runTest('Concurrent HTTP Requests', async () => {
      const concurrent = 20;
      const logsPerWorker = 25;
      
      const workers = Array.from({ length: concurrent }, async (_, workerId) => {
        let sent = 0;
        let errors = 0;
        
        for (let i = 0; i < logsPerWorker; i++) {
          const log = this.generator.generateLog();
          const success = await this.generator.sendLog(log);
          
          if (success) {
            sent++;
          } else {
            errors++;
          }
        }
        
        return { sent, errors };
      });
      
      const results = await Promise.all(workers);
      const sent = results.reduce((sum, r) => sum + r.sent, 0);
      const errors = results.reduce((sum, r) => sum + r.errors, 0);
      
      console.log(`   Workers: ${concurrent}, Logs per worker: ${logsPerWorker}`);
      
      return { sent, errors, duration: 0 };
    });
  }

  async testHighVolumeStream(): Promise<TestResult> {
    return this.runTest('High Volume Stream', async () => {
      return new Promise((resolve) => {
        const logsPerSecond = 100;
        const duration = 30; // 30 секунд
        const interval = 1000 / logsPerSecond;
        
        let sent = 0;
        let errors = 0;
        let startTime = Date.now();
        
        const timer = setInterval(async () => {
          const log = this.generator.generateLog();
          const success = await this.generator.sendLog(log);
          
          if (success) {
            sent++;
          } else {
            errors++;
          }
          
          const elapsed = (Date.now() - startTime) / 1000;
          process.stdout.write(`\r   Rate: ${logsPerSecond} logs/sec, Sent: ${sent}, Elapsed: ${elapsed.toFixed(1)}s`);
          
          if (elapsed >= duration) {
            clearInterval(timer);
            process.stdout.write(`\n`);
            resolve({ sent, errors, duration: elapsed });
          }
        }, interval);
      });
    });
  }

  async testSystemQuery(): Promise<void> {
    console.log(`\n🔍 Testing query functionality:`);
    console.log('━'.repeat(50));
    
    try {
      // Тест базового health check
      const healthResponse = await fetch(`${this.endpoint}/health`);
      console.log(`   Health check: ${healthResponse.ok ? '✅' : '❌'}`);
      
      // Тест получения ошибок
      const errorsResponse = await fetch(`${this.endpoint}/errors?hours=1`);
      if (errorsResponse.ok) {
        const errors = await errorsResponse.json();
        console.log(`   Error logs query: ✅ (${Array.isArray(errors.data) ? errors.data.length : 0} results)`);
      } else {
        console.log(`   Error logs query: ❌`);
      }
      
      // Тест кастомного SQL запроса
      const sqlResponse = await fetch(`${this.endpoint}/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sql: "SELECT COUNT(*) as total FROM file('./data/parquet/logs_*.parquet', 'Parquet')" 
        })
      });
      
      if (sqlResponse.ok) {
        const result = await sqlResponse.json();
        console.log(`   Custom SQL query: ✅`);
      } else {
        console.log(`   Custom SQL query: ❌ (${sqlResponse.status})`);
      }
      
    } catch (error) {
      console.log(`   Query tests failed: ${error.message}`);
    }
  }

  private printSummary(): void {
    console.log(`\n📊 Performance Test Summary:`);
    console.log('━'.repeat(80));
    console.log(`${'Test Name'.padEnd(25)} ${'Logs'.padStart(8)} ${'Duration'.padStart(10)} ${'Rate'.padStart(12)} ${'Status'.padStart(8)}`);
    console.log('─'.repeat(80));
    
    this.results.forEach(result => {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      console.log(
        `${result.testName.padEnd(25)} ` +
        `${result.totalLogs.toString().padStart(8)} ` +
        `${result.duration.toFixed(2).padStart(8)}s ` +
        `${result.logsPerSecond.toFixed(1).padStart(10)} logs/s ` +
        `${status.padStart(8)}`
      );
    });
    
    console.log('─'.repeat(80));
    
    const totalLogs = this.results.reduce((sum, r) => sum + r.totalLogs, 0);
    const avgRate = this.results.reduce((sum, r) => sum + r.logsPerSecond, 0) / this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    
    console.log(`Total logs processed: ${totalLogs}`);
    console.log(`Average rate: ${avgRate.toFixed(1)} logs/sec`);
    console.log(`Tests passed: ${passedTests}/${this.results.length}`);
    
    const maxRate = Math.max(...this.results.map(r => r.logsPerSecond));
    const bestTest = this.results.find(r => r.logsPerSecond === maxRate);
    console.log(`Best performance: ${bestTest?.testName} (${maxRate.toFixed(1)} logs/sec)`);
  }

  async runAllTests(): Promise<void> {
    console.log(`🚀 Starting performance tests against ${this.endpoint}`);
    
    // Проверяем доступность сервиса
    console.log(`\n🔌 Checking service availability...`);
    const isHealthy = await this.checkHealth();
    
    if (!isHealthy) {
      console.error(`❌ Service is not available at ${this.endpoint}`);
      console.log(`   Make sure the log aggregator is running with: bun start`);
      process.exit(1);
    }
    
    console.log(`✅ Service is healthy and ready for testing`);
    
    // Запускаем тесты
    await this.testSingleRequests();
    await this.testBatchRequests();
    await this.testConcurrentRequests();
    await this.testHighVolumeStream();
    
    // Тестируем запросы
    await this.testSystemQuery();
    
    // Выводим сводку
    this.printSummary();
  }
}

// CLI
async function main() {
  const endpoint = process.env.LOG_ENDPOINT || 'http://localhost:3009';
  const tester = new PerformanceTest(endpoint);
  
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`🧪 Performance Test Usage:
    
    bun test-performance.ts [options]
    
    Environment variables:
    LOG_ENDPOINT - Target endpoint (default: http://localhost:3009)
    
    Options:
    --help, -h     Show this help
    
    Examples:
    bun test-performance.ts
    LOG_ENDPOINT=http://remote:3009 bun test-performance.ts
    `);
    process.exit(0);
  }
  
  try {
    await tester.runAllTests();
  } catch (error) {
    console.error(`\n❌ Test execution failed:`, error.message);
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}