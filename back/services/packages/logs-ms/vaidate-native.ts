// validate-native.ts
import { readFileSync, writeFileSync } from 'fs';

interface NativeBlockHeader {
  num_columns: number;
  num_rows: number;
}

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

function analyzeNativeFormat() {
  try {
    const buffer = readFileSync('./data.native');
    console.log('=== АНАЛИЗ ClickHouse Native FORMAT ===\n');
    
    let offset = 0;
    
    // Читаем заголовок блока
    if (buffer.length < 8) {
      console.log('❌ Файл слишком маленький для Native формата');
      return;
    }
    
    try {
      // В Native формате первые данные - это VarInt
      console.log('Попытка чтения как Native format...');
      
      const [numColumns, newOffset1] = readVarInt(buffer, offset);
      const [numRows, newOffset2] = readVarInt(buffer, newOffset1);
      
      console.log(`Количество колонок: ${numColumns}`);
      console.log(`Количество строк: ${numRows}`);
      console.log(`Использовано байт для заголовка: ${newOffset2}`);
      
      offset = newOffset2;
      
      // Для каждой колонки читаем метаданные
      for (let col = 0; col < numColumns && offset < buffer.length; col++) {
        console.log(`\n--- Колонка ${col + 1} ---`);
        
        // Читаем длину имени колонки
        if (offset >= buffer.length) break;
        const [nameLength, nameOffset] = readVarInt(buffer, offset);
        offset = nameOffset;
        
        // Читаем имя колонки
        if (offset + nameLength > buffer.length) {
          console.log('❌ Недостаточно данных для имени колонки');
          break;
        }
        
        const columnName = buffer.slice(offset, offset + nameLength).toString('utf8');
        offset += nameLength;
        console.log(`Имя колонки: "${columnName}"`);
        
        // Читаем длину типа колонки
        if (offset >= buffer.length) break;
        const [typeLength, typeOffset] = readVarInt(buffer, offset);
        offset = typeOffset;
        
        // Читаем тип колонки
        if (offset + typeLength > buffer.length) {
          console.log('❌ Недостаточно данных для типа колонки');
          break;
        }
        
        const columnType = buffer.slice(offset, offset + typeLength).toString('utf8');
        offset += typeLength;
        console.log(`Тип колонки: "${columnType}"`);
      }
      
      console.log(`\nДанные начинаются с позиции: ${offset}`);
      console.log(`Оставшиеся байты для данных: ${buffer.length - offset}`);
      
      // Пытаемся прочитать данные
      if (numColumns === 1 && numRows > 0) {
        console.log('\n--- ДАННЫЕ ---');
        const expectedDataSize = numRows * 4; // Int32 = 4 байта
        const actualDataSize = buffer.length - offset;
        
        console.log(`Ожидаемый размер данных: ${expectedDataSize} байт`);
        console.log(`Фактический размер данных: ${actualDataSize} байт`);
        
        if (actualDataSize < expectedDataSize) {
          console.log('❌ Недостаточно данных!');
          console.log(`Недостает: ${expectedDataSize - actualDataSize} байт`);
        } else {
          console.log('✅ Размер данных соответствует ожиданиям');
          
          // Читаем первые несколько значений
          for (let i = 0; i < Math.min(numRows, 5) && offset + 4 <= buffer.length; i++) {
            const value = buffer.readInt32LE(offset);
            console.log(`Значение ${i + 1}: ${value}`);
            offset += 4;
          }
        }
      }
      
    } catch (error) {
      console.log('❌ Ошибка при парсинге Native формата:', error);
      console.log('\nВозможно, файл не в формате ClickHouse Native или поврежден');
    }
    
  } catch (error) {
    console.error('Ошибка при чтении файла:', error);
  }
}

// Функция для создания корректного Native файла для тестирования
function createTestNativeFile() {
  console.log('\n=== СОЗДАНИЕ ТЕСТОВОГО ФАЙЛА ===');
  
  const values = [1, 2, 3, 4, 5];
  const numColumns = 1;
  const numRows = values.length;
  
  // Создаем буфер
  const buffers: Buffer[] = [];
  
  // Записываем количество колонок (VarInt)
  buffers.push(Buffer.from([numColumns]));
  
  // Записываем количество строк (VarInt)
  buffers.push(Buffer.from([numRows]));
  
  // Записываем метаданные колонки
  const columnName = 'value';
  const columnType = 'Int32';
  
  // Длина имени колонки
  buffers.push(Buffer.from([columnName.length]));
  // Имя колонки
  buffers.push(Buffer.from(columnName, 'utf8'));
  // Длина типа колонки
  buffers.push(Buffer.from([columnType.length]));
  // Тип колонки
  buffers.push(Buffer.from(columnType, 'utf8'));
  
  // Записываем данные
  for (const value of values) {
    const valueBuffer = Buffer.allocUnsafe(4);
    valueBuffer.writeInt32LE(value, 0);
    buffers.push(valueBuffer);
  }
  
  const finalBuffer = Buffer.concat(buffers);
  writeFileSync('./data_test.native', finalBuffer);
  
  console.log(`Создан тестовый файл data_test.native размером ${finalBuffer.length} байт`);
  console.log('Попробуйте использовать его для тестирования');
}

console.log('Анализ существующего файла:');
analyzeNativeFormat();

console.log('\n' + '='.repeat(60));
createTestNativeFile();