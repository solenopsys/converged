// detailed-debug.ts
import { readFileSync } from 'fs';

function readVarInt(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let currentOffset = offset;
  
  while (currentOffset < buffer.length) {
    const byte = buffer[currentOffset++];
    value |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  
  return [value, currentOffset];
}

function analyzeFile(filename: string) {
  console.log(`\n=== АНАЛИЗ ${filename} ===`);
  
  try {
    const buffer = readFileSync(filename);
    console.log(`Размер файла: ${buffer.length} байт`);
    
    // Hex дамп
    console.log('\nHEX ДАМП:');
    for (let i = 0; i < buffer.length; i += 16) {
      const chunk = buffer.slice(i, Math.min(i + 16, buffer.length));
      const hex = Array.from(chunk).map(b => b.toString(16).padStart(2, '0')).join(' ');
      const ascii = Array.from(chunk).map(b => (b >= 32 && b <= 126) ? String.fromCharCode(b) : '.').join('');
      console.log(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(47, ' ')} |${ascii}|`);
    }
    
    // Парсинг Native формата
    console.log('\nПАРСИНГ NATIVE ФОРМАТА:');
    let offset = 0;
    
    // Читаем количество колонок
    const [numColumns, offset1] = readVarInt(buffer, offset);
    console.log(`Количество колонок: ${numColumns}`);
    offset = offset1;
    
    // Читаем количество строк
    const [numRows, offset2] = readVarInt(buffer, offset);
    console.log(`Количество строк: ${numRows}`);
    offset = offset2;
    
    // Читаем метаданные колонок
    for (let col = 0; col < numColumns && offset < buffer.length; col++) {
      console.log(`\nКолонка ${col + 1}:`);
      
      // Читаем длину имени колонки
      const [nameLength, nameOffset] = readVarInt(buffer, offset);
      offset = nameOffset;
      console.log(`  Длина имени: ${nameLength}`);
      
      if (offset + nameLength > buffer.length) {
        console.log('  ❌ Недостаточно данных для имени колонки');
        return;
      }
      
      // Читаем имя колонки
      const columnName = buffer.slice(offset, offset + nameLength).toString('utf8');
      offset += nameLength;
      console.log(`  Имя: "${columnName}"`);
      
      // Читаем длину типа колонки
      const [typeLength, typeOffset] = readVarInt(buffer, offset);
      offset = typeOffset;
      console.log(`  Длина типа: ${typeLength}`);
      
      if (offset + typeLength > buffer.length) {
        console.log('  ❌ Недостаточно данных для типа колонки');
        return;
      }
      
      // Читаем тип колонки
      const columnType = buffer.slice(offset, offset + typeLength).toString('utf8');
      offset += typeLength;
      console.log(`  Тип: "${columnType}"`);
    }
    
    console.log(`\nДанные начинаются с позиции: ${offset}`);
    console.log(`Оставшиеся байты для данных: ${buffer.length - offset}`);
    
    // Читаем данные Int32 колонки
    if (numColumns >= 1 && numRows > 0) {
      console.log('\nДАННЫЕ Int32 КОЛОНКИ:');
      const expectedDataSize = numRows * 4;
      const availableData = buffer.length - offset;
      
      console.log(`Ожидаемый размер: ${expectedDataSize} байт`);
      console.log(`Доступно: ${availableData} байт`);
      
      if (availableData >= expectedDataSize) {
        for (let i = 0; i < Math.min(numRows, 10) && offset + 4 <= buffer.length; i++) {
          const value = buffer.readInt32LE(offset);
          console.log(`  Значение ${i + 1}: ${value}`);
          offset += 4;
        }
      } else {
        console.log('❌ Недостаточно данных для Int32 значений');
      }
    }
    
    if (offset < buffer.length) {
      console.log(`\nОставшиеся байты: ${buffer.length - offset}`);
      const remaining = buffer.slice(offset);
      console.log('Остаток (hex):', Array.from(remaining).map(b => b.toString(16).padStart(2, '0')).join(' '));
    }
    
  } catch (error) {
    console.log('❌ Ошибка при чтении файла:', error);
  }
}

// Создаем эталонный файл вручную для сравнения
function createReferenceFile() {
  console.log('\n=== СОЗДАНИЕ ЭТАЛОННОГО ФАЙЛА ===');
  
  const values = [1, 2, 3, 42, 100];
  const buffers: Buffer[] = [];
  
  // Количество колонок (1)
  buffers.push(Buffer.from([1]));
  
  // Количество строк (5)
  buffers.push(Buffer.from([5]));
  
  // Длина имени колонки (5)
  buffers.push(Buffer.from([5]));
  
  // Имя колонки "value"
  buffers.push(Buffer.from('value', 'utf8'));
  
  // Длина типа колонки (5)
  buffers.push(Buffer.from([5]));
  
  // Тип колонки "Int32"
  buffers.push(Buffer.from('Int32', 'utf8'));
  
  // Данные Int32
  for (const value of values) {
    const valueBuffer = Buffer.allocUnsafe(4);
    valueBuffer.writeInt32LE(value, 0);
    buffers.push(valueBuffer);
  }
  
  const referenceBuffer = Buffer.concat(buffers);
  require('fs').writeFileSync('./reference.native', referenceBuffer);
  
  console.log(`Создан эталонный файл reference.native размером ${referenceBuffer.length} байт`);
  return referenceBuffer.length;
}

async function testFiles() {
  // Создаем эталонный файл
  createReferenceFile();
  
  // Анализируем все файлы
  const files = ['data.native', 'reference.native'];
  
  for (const file of files) {
    try {
      analyzeFile(file);
    } catch (error) {
      console.log(`Файл ${file} не найден или не читается`);
    }
  }
  
  // Тестируем эталонный файл с ClickHouse
  console.log('\n=== ТЕСТ ЭТАЛОННОГО ФАЙЛА ===');
  try {
    const { query } = await import("@lithdew/chdb-bun");
    const sql = `SELECT * FROM file('./reference.native', 'Native', 'value Int32')`;
    const res = await query(sql);
    console.log('✅ Эталонный файл работает:', res);
  } catch (error) {
    console.log('❌ Ошибка с эталонным файлом:', error.message);
  }
}

testFiles().catch(console.error);