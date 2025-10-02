// query-logs.ts
import { query } from "@lithdew/chdb-bun";

async function queryLogsFile(filename: string = './logs.native') {
  console.log(`🔍 Читаем ${filename}...\n`);

  try {
    console.log('=== ВСЕ ЛОГИ ===');
    const allLogs = await query(`SELECT * FROM file('${filename}', 'Native') ORDER BY timestamp`);
    console.log(allLogs);
    console.log();

    console.log('=== СТАТИСТИКА ===');
    const count = await query(`SELECT COUNT(*) as total FROM file('${filename}', 'Native')`);
    console.log(count);

    console.log('\n=== ПО УРОВНЯМ ===');
    const byLevel = await query(`
      SELECT level, COUNT(*) as cnt, AVG(response_time_ms) as avg_time
      FROM file('${filename}', 'Native')
      GROUP BY level
      ORDER BY cnt DESC
    `);
    console.log(byLevel);

    console.log(`\n✅ ${filename} прочитан успешно!`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function queryMetricsFile(filename: string = './metrics_compressed.native') {
  console.log('\n' + '='.repeat(70));
  console.log(`🔍 Читаем ${filename}...\n`);

  try {
    console.log('=== ВСЕ МЕТРИКИ ===');
    const all = await query(`
      SELECT 
        formatDateTime(timestamp, '%Y-%m-%d %H:%M:%S') as time,
        metric_name, round(value, 2) as val, host, datacenter
      FROM file('${filename}', 'Native')
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
      FROM file('${filename}', 'Native')
      GROUP BY metric_name
    `);
    console.log(stats);

    console.log(`\n✅ ${filename} прочитан успешно!`);

  } catch (error) {
    console.error('❌ Ошибка:', error);
  }
}

async function compareCompression() {
  console.log('\n' + '='.repeat(70));
  console.log('📊 СРАВНЕНИЕ СЖАТИЯ\n');

  const fs = await import('fs');
  
  try {
    const files = [
      { name: 'logs.native', label: 'Без сжатия' },
      { name: 'logs_compressed.native', label: 'LZ4 блоки' },
    ];

    console.log('Размеры файлов:');
    const sizes: { [key: string]: number } = {};
    
    for (const file of files) {
      if (fs.existsSync(`./${file.name}`)) {
        const size = fs.statSync(`./${file.name}`).size;
        sizes[file.name] = size;
        console.log(`  ${file.label.padEnd(15)} ${file.name.padEnd(25)} ${size.toString().padStart(6)} байт`);
      } else {
        console.log(`  ${file.label.padEnd(15)} ${file.name.padEnd(25)} не найден`);
      }
    }

    if (sizes['logs.native'] && sizes['logs_compressed.native']) {
      const ratio = (sizes['logs_compressed.native'] / sizes['logs.native'] * 100).toFixed(1);
      const saved = sizes['logs.native'] - sizes['logs_compressed.native'];
      console.log(`\n  Степень сжатия: ${ratio}%`);
      console.log(`  Экономия: ${saved} байт`);
    }

    console.log('\n=== ПРОВЕРКА ДАННЫХ ===');
    
    const uncompressed = await query(`SELECT COUNT(*) as cnt FROM file('./logs.native', 'Native')`);
    const compressed = await query(`SELECT COUNT(*) as cnt FROM file('./logs_compressed.native', 'Native')`);
    
    console.log(`Записей в logs.native: ${uncompressed.data[0].cnt}`);
    console.log(`Записей в logs_compressed.native: ${compressed.data[0].cnt}`);
    
    if (uncompressed.data[0].cnt === compressed.data[0].cnt) {
      console.log('✅ Количество записей совпадает!');
      
      const data1 = await query(`SELECT * FROM file('./logs.native', 'Native') ORDER BY timestamp`);
      const data2 = await query(`SELECT * FROM file('./logs_compressed.native', 'Native') ORDER BY timestamp`);
      
      if (JSON.stringify(data1.data) === JSON.stringify(data2.data)) {
        console.log('✅ Данные полностью идентичны!');
      } else {
        console.log('⚠️  Данные отличаются!');
      }
    } else {
      console.log('❌ Количество записей не совпадает!');
    }

  } catch (error) {
    console.error('❌ Ошибка при сравнении:', error);
  }
}

async function diagnoseFiles() {
  console.log('🔍 ДИАГНОСТИКА ФАЙЛОВ\n');
  
  const fs = await import('fs');
  
  const files = [
    'logs.native',
    'logs_compressed.native', 
    'metrics_compressed.native'
  ];

  for (const filename of files) {
    if (fs.existsSync(`./${filename}`)) {
      const buf = fs.readFileSync(`./${filename}`);
      console.log(`✅ ${filename}:`, buf.length, 'байт');
      
      const hex = buf.slice(0, 32).toString('hex').match(/.{1,2}/g)?.join(' ');
      console.log('   Hex:', hex);
      
      if (buf.length > 16) {
        const first16 = buf.slice(0, 16);
        const isZeroChecksum = first16.every(b => b === 0);
        if (isZeroChecksum && buf[16] === 0x82) {
          console.log('   Формат: ClickHouse LZ4 блоки (нулевой checksum)');
        } else if (buf[16] === 0x82) {
          console.log('   Формат: ClickHouse LZ4 блоки (с checksum)');
        } else if (buf[0] < 0x10) {
          console.log('   Формат: Native несжатый (UVarInt начало)');
        } else {
          console.log('   Формат: неизвестен');
        }
      }
      console.log();
    } else {
      console.log(`❌ ${filename} не найден\n`);
    }
  }
  
  console.log('='.repeat(70));
}

async function testAllFiles() {
  console.log('\n' + '='.repeat(70));
  console.log('🧪 ТЕСТИРОВАНИЕ ВСЕХ ФАЙЛОВ\n');

  const files = [
    { name: 'logs.native', desc: 'Логи без сжатия' },
    { name: 'logs_compressed.native', desc: 'Логи LZ4 блоки' },
    { name: 'metrics_compressed.native', desc: 'Метрики LZ4 блоки' },
  ];

  for (const file of files) {
    console.log(`\n📄 ${file.desc} (${file.name})`);
    try {
      const result = await query(`SELECT COUNT(*) as cnt FROM file('./${file.name}', 'Native')`);
      console.log(`   ✅ Прочитано записей: ${result.data[0].cnt}`);
      
      const sample = await query(`SELECT * FROM file('./${file.name}', 'Native') LIMIT 1`);
      console.log(`   ✅ Колонки: ${Object.keys(sample.data[0]).join(', ')}`);
    } catch (error) {
      console.log(`   ❌ Ошибка чтения: ${error}`);
    }
  }
}

async function main() {
  console.log('ClickHouse Native Format - Блочное LZ4 сжатие');
  console.log('='.repeat(70));
  console.log();

  await diagnoseFiles();
  await testAllFiles();
  await compareCompression();
  
  console.log('\n' + '='.repeat(70));
  await queryLogsFile('./logs.native');
  
  console.log('\n' + '='.repeat(70));
  await queryLogsFile('./logs_compressed.native');
  
  await queryMetricsFile('./metrics_compressed.native');

  console.log('\n' + '='.repeat(70));
  console.log('✅ ГОТОВО');
  console.log('\nТестируем блочное LZ4 сжатие по формату ClickHouse Native protocol');
}

main().catch((e) => {
  console.error('💥 Ошибка:', e);
  process.exit(1);
});