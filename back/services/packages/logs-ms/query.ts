// query.ts
import { query } from "@lithdew/chdb-bun";

// Обновленная структура с двумя колонками (соответствует вашему файлу)
const STRUCT = "value Int32, message String";

async function main() {
  console.log('🔍 Тестируем чтение сжатых строк из Native формата...\n');

  try {
    const sql = `
      SELECT *
      FROM file('./data.native', 'Native', '${STRUCT}')
    `;

    const res = await query(sql);
    console.log('=== ВСЕ ДАННЫЕ ===');
    console.log(res);
    
    // Дополнительные запросы для анализа
    console.log('\n=== ДЕТАЛЬНЫЙ АНАЛИЗ ===');
    
    // Количество записей
    const countSql = `SELECT COUNT(*) as total_rows FROM file('./data.native', 'Native', '${STRUCT}')`;
    const countRes = await query(countSql);
    console.log('Общее количество строк:', countRes);
    
    // Все строки по порядку с детальным выводом
    const orderedSql = `
      SELECT value, message 
      FROM file('./data.native', 'Native', '${STRUCT}') 
      ORDER BY value
    `;
    const orderedRes = await query(orderedSql);
    console.log('\n=== ДЕКОМПРЕССИРОВАННЫЕ СТРОКИ ===');
    
    if (orderedRes.data && Array.isArray(orderedRes.data)) {
      orderedRes.data.forEach((row: any, index: number) => {
        console.log(`${index + 1}. value: ${row.value}, message: "${row.message}" (длина: ${row.message.length})`);
      });
    } else {
      // Альтернативный способ парсинга для разных форматов ответа
      const dataStr = String(orderedRes.data || orderedRes);
      console.log('Сырые данные:', dataStr);
      
      // Парсим строки из текстового вывода
      const lines = dataStr.split('\n').filter(line => line.trim());
      lines.forEach((line, index) => {
        console.log(`${index + 1}. ${line}`);
      });
    }
    
    // Статистика по длинам строк с дополнительной информацией
    console.log('\n=== СТАТИСТИКА СООБЩЕНИЙ ===');
    const lengthSql = `
      SELECT 
        value,
        message,
        length(message) as msg_length,
        upper(message) as msg_upper,
        contains(message, 'Test') as contains_test
      FROM file('./data.native', 'Native', '${STRUCT}') 
      ORDER BY value
    `;
    const lengthRes = await query(lengthSql);
    console.log(lengthRes);
    
    // Проверка функциональности строковых функций
    console.log('\n=== ТЕСТ СТРОКОВЫХ ФУНКЦИЙ ===');
    const stringFuncSql = `
      SELECT 
        value,
        message,
        substring(message, 1, 10) as first_10_chars,
        reverse(message) as reversed,
        concat('Префикс: ', message) as with_prefix
      FROM file('./data.native', 'Native', '${STRUCT}') 
      WHERE value <= 3
      ORDER BY value
    `;
    const stringFuncRes = await query(stringFuncSql);
    console.log(stringFuncRes);
    
    // Поиск по содержимому
    console.log('\n=== ПОИСК ПО СОДЕРЖИМОМУ ===');
    const searchSql = `
      SELECT 
        value, 
        message 
      FROM file('./data.native', 'Native', '${STRUCT}') 
      WHERE message LIKE '%message%' OR message LIKE '%Test%'
      ORDER BY value
    `;
    const searchRes = await query(searchSql);
    console.log('Найдено сообщений с "message" или "Test":', searchRes);
    
    // Агрегация по строкам
    console.log('\n=== АГРЕГАЦИЯ ===');
    const aggSql = `
      SELECT 
        COUNT(*) as total_messages,
        AVG(length(message)) as avg_length,
        MAX(length(message)) as max_length,
        MIN(length(message)) as min_length
      FROM file('./data.native', 'Native', '${STRUCT}')
    `;
    const aggRes = await query(aggSql);
    console.log('Статистика сообщений:', aggRes);
    
    console.log('\n✅ Тест успешно завершен! Сжатые строки корректно читаются и обрабатываются.');
    
  } catch (error) {
    console.error('❌ Ошибка при чтении сжатых данных:', error);
    
    // Дополнительная диагностика
    console.log('\n🔧 ДИАГНОСТИКА:');
    console.log('1. Проверьте, что файл data.native создан с компрессией');
    console.log('2. Убедитесь, что структура соответствует: "value Int32, message String"');
    console.log('3. Проверьте формат сжатия в файле (должен быть gzip/0x82)');
    
    // Попробуем прочитать как текст для диагностики
    try {
      const diagSql = `SELECT count(*) FROM file('./data.native', 'Native', 'value Int32')`;
      const diagRes = await query(diagSql);
      console.log('4. Тест с одной колонкой:', diagRes);
    } catch (diagError) {
      console.log('4. Файл полностью не читается:', diagError.message);
    }
  }
}

main().catch((e) => {
  console.error('💥 Критическая ошибка:', e);
  process.exit(1);
});