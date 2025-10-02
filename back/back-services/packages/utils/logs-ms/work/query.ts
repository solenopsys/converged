// query-logs.ts
import { query } from "@lithdew/chdb-bun";

async function queryLogsFile() {
  console.log('🔍 Читаем logs.native...\n');

  try {
    // Native формат содержит метаданные - структуру указывать НЕ НУЖНО!
    console.log('=== ВСЕ ЛОГИ ===');
    const allLogs = await query(`SELECT * FROM file('./logs.native', 'Native') ORDER BY timestamp`);
    console.log(allLogs);
    console.log();

    console.log('=== СТАТИСТИКА ===');
    const count = await query(`SELECT COUNT(*) as total FROM file('./logs.native', 'Native')`);
    console.log(count);

    console.log('\n=== ПО УРОВНЯМ ===');
    const byLevel = await query(`
      SELECT level, COUNT(*) as cnt, AVG(response_time_ms) as avg_time
      FROM file('./logs.native', 'Native')
      GROUP BY level
      ORDER BY cnt DESC
    `);
    console.log(byLevel);

    console.log('\n=== ДЕТАЛИ ===');
    const details = await query(`
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S') as time,
        level, service, user_id, response_time_ms, status_code
      FROM file('./logs.native', 'Native')
      ORDER BY timestamp
    `);
    console.log(details);

    console.log('\n=== ОШИБКИ ===');
    const errors = await query(`
      SELECT * FROM file('./logs.native', 'Native')
      WHERE level = 'ERROR' OR status_code >= 400
    `);
    console.log(errors);

    console.log('\n✅ logs.native прочитан успешно!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function queryMetricsFile() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 Читаем metrics.native...\n');

  try {
    console.log('=== ВСЕ МЕТРИКИ ===');
    const all = await query(`
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S') as time,
        metric_name, round(value, 2) as val, host, datacenter
      FROM file('./metrics.native', 'Native')
      ORDER BY timestamp, metric_name
    `);
    console.log(all);

    console.log('\n=== СТАТИСТИКА ===');
    const stats = await query(`
      SELECT 
        metric_name,
        COUNT(*) as cnt,
        round(AVG(value), 2) as avg,
        round(MAX(value), 2) as max,
        round(MIN(value), 2) as min
      FROM file('./metrics.native', 'Native')
      GROUP BY metric_name
    `);
    console.log(stats);

    console.log('\n=== ПО ХОСТАМ ===');
    const hosts = await query(`
      SELECT host, datacenter, COUNT(*) as cnt
      FROM file('./metrics.native', 'Native')
      GROUP BY host, datacenter
    `);
    console.log(hosts);

    console.log('\n✅ metrics.native прочитан успешно!');

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function combineAnalysis() {
  console.log('\n' + '='.repeat(70));
  console.log('🔍 КОМБИНИРОВАННЫЙ АНАЛИЗ\n');

  try {
    const combined = await query(`
      SELECT 'logs' as source, COUNT(*) as records
      FROM file('./logs.native', 'Native')
      UNION ALL
      SELECT 'metrics' as source, COUNT(*) as records
      FROM file('./metrics.native', 'Native')
    `);
    console.log(combined);
  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function diagnoseFiles() {
  console.log('🔍 ДИАГНОСТИКА ФАЙЛОВ\n');
  
  const fs = await import('fs');
  
  if (fs.existsSync('./logs.native')) {
    const buf = fs.readFileSync('./logs.native');
    console.log('✅ logs.native:', buf.length, 'байт');
    const hex = buf.slice(0, 32).toString('hex').match(/.{1,2}/g)?.join(' ');
    console.log('   Hex:', hex);
  } else {
    console.log('❌ logs.native не найден');
  }
  
  if (fs.existsSync('./metrics.native')) {
    const buf = fs.readFileSync('./metrics.native');
    console.log('\n✅ metrics.native:', buf.length, 'байт');
    const hex = buf.slice(0, 32).toString('hex').match(/.{1,2}/g)?.join(' ');
    console.log('   Hex:', hex);
  } else {
    console.log('\n❌ metrics.native не найден');
  }
  
  console.log('\n' + '='.repeat(70));
}

async function main() {
  console.log('ClickHouse Native Format Query Tool');
  console.log('='.repeat(70));
  console.log();

  await diagnoseFiles();
  await queryLogsFile();
  await queryMetricsFile();
  // UNION ALL в chdb имеет баг с мультифайлами - пропускаем
  // await combineAnalysis();

  console.log('\n' + '='.repeat(70));
  console.log('✅ ГОТОВО');
  console.log('\n💡 Native формат самодостаточен - метаданные внутри файла!');
  console.log('💡 Zig writer корректно записывает данные для ClickHouse/chdb');
}

main().catch((e) => {
  console.error('💥 Ошибка:', e);
  process.exit(1);
});