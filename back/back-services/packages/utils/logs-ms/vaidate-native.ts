// diagnose-native.ts
import { readFileSync, existsSync } from 'fs';

function readVarInt(buffer: Buffer, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let currentOffset = offset;
  
  while (currentOffset < buffer.length) {
    const byte = buffer[currentOffset++];
    value |= (byte & 0x7F) << shift;
    
    if ((byte & 0x80) === 0) {
      break;
    }
    shift += 7;
    
    if (shift > 63) {
      throw new Error('VarInt слишком большой');
    }
  }
  
  return [value, currentOffset];
}

function analyzeNativeFile(filePath: string) {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`АНАЛИЗ: ${filePath}`);
  console.log('='.repeat(70));
  
  if (!existsSync(filePath)) {
    console.log(`❌ Файл не найден: ${filePath}\n`);
    return;
  }
  
  const buffer = readFileSync(filePath);
  console.log(`📦 Размер файла: ${buffer.length} байт\n`);
  
  // Первые 64 байта в hex
  const previewSize = Math.min(64, buffer.length);
  const hexLines: string[] = [];
  for (let i = 0; i < previewSize; i += 16) {
    const chunk = buffer.slice(i, Math.min(i + 16, previewSize));
    const hex = Array.from(chunk)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ');
    const ascii = Array.from(chunk)
      .map(b => (b >= 32 && b < 127) ? String.fromCharCode(b) : '.')
      .join('');
    hexLines.push(`${i.toString(16).padStart(4, '0')}: ${hex.padEnd(48, ' ')} | ${ascii}`);
  }
  
  console.log('🔍 Hex dump (первые 64 байта):');
  hexLines.forEach(line => console.log(`   ${line}`));
  console.log();
  
  try {
    let offset = 0;
    
    // Читаем заголовок
    const [numColumns, offset1] = readVarInt(buffer, offset);
    const [numRows, offset2] = readVarInt(buffer, offset1);
    
    console.log('📊 ЗАГОЛОВОК:');
    console.log(`   Количество колонок: ${numColumns}`);
    console.log(`   Количество строк: ${numRows}`);
    console.log(`   Байт использовано: ${offset2}\n`);
    
    offset = offset2;
    
    // Читаем метаданные колонок
    console.log('📋 КОЛОНКИ:');
    const columns: Array<{ name: string; type: string }> = [];
    
    for (let i = 0; i < numColumns; i++) {
      // Длина имени
      const [nameLen, nameOffset] = readVarInt(buffer, offset);
      offset = nameOffset;
      
      // Имя колонки
      if (offset + nameLen > buffer.length) {
        console.log(`   ❌ Недостаточно данных для имени колонки ${i + 1}`);
        return;
      }
      const name = buffer.slice(offset, offset + nameLen).toString('utf8');
      offset += nameLen;
      
      // Длина типа
      const [typeLen, typeOffset] = readVarInt(buffer, offset);
      offset = typeOffset;
      
      // Тип колонки
      if (offset + typeLen > buffer.length) {
        console.log(`   ❌ Недостаточно данных для типа колонки ${i + 1}`);
        return;
      }
      const type = buffer.slice(offset, offset + typeLen).toString('utf8');
      offset += typeLen;
      
      columns.push({ name, type });
      console.log(`   ${i + 1}. "${name}" (${type})`);
    }
    
    console.log(`\n📍 Данные начинаются с байта: ${offset}`);
    console.log(`📏 Размер области данных: ${buffer.length - offset} байт\n`);
    
    // Генерируем SQL структуру
    console.log('💻 SQL СТРУКТУРА ДЛЯ ЧТЕНИЯ:');
    const sqlStruct = columns.map(c => `${c.name} ${c.type}`).join(', ');
    console.log(`   "${sqlStruct}"\n`);
    
    // Пример SQL запроса
    console.log('📝 ПРИМЕР ЗАПРОСА:');
    console.log(`   SELECT * FROM file('${filePath}', 'Native', '${sqlStruct}')\n`);
    
    // Пытаемся прочитать первые значения каждой колонки
    console.log('🔎 ПРЕДПРОСМОТР ДАННЫХ (первая строка):');
    for (let colIdx = 0; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx];
      const type = col.type.toLowerCase();
      
      let value: any = '<не прочитано>';
      
      try {
        if (type === 'int8') {
          value = buffer.readInt8(offset);
          offset += 1;
        } else if (type === 'uint8') {
          value = buffer.readUInt8(offset);
          offset += 1;
        } else if (type === 'int16') {
          value = buffer.readInt16LE(offset);
          offset += 2;
        } else if (type === 'uint16') {
          value = buffer.readUInt16LE(offset);
          offset += 2;
        } else if (type === 'int32') {
          value = buffer.readInt32LE(offset);
          offset += 4;
        } else if (type === 'uint32' || type === 'datetime') {
          value = buffer.readUInt32LE(offset);
          if (type === 'datetime') {
            value = `${value} (${new Date(value * 1000).toISOString()})`;
          }
          offset += 4;
        } else if (type === 'int64' || type.startsWith('datetime64')) {
          value = buffer.readBigInt64LE(offset);
          if (type.startsWith('datetime64')) {
            value = `${value} (${new Date(Number(value)).toISOString()})`;
          }
          offset += 8;
        } else if (type === 'uint64') {
          value = buffer.readBigUInt64LE(offset);
          offset += 8;
        } else if (type === 'float32') {
          value = buffer.readFloatLE(offset).toFixed(2);
          offset += 4;
        } else if (type === 'float64') {
          value = buffer.readDoubleLE(offset).toFixed(2);
          offset += 8;
        } else if (type === 'uuid') {
          const uuidBytes = buffer.slice(offset, offset + 16);
          value = uuidBytes.toString('hex')
            .replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
          offset += 16;
        } else if (type === 'string') {
          const [strLen, strOffset] = readVarInt(buffer, offset);
          offset = strOffset;
          if (offset + strLen <= buffer.length) {
            value = `"${buffer.slice(offset, offset + strLen).toString('utf8')}"`;
            offset += strLen;
          } else {
            value = '<недостаточно данных>';
          }
        } else {
          value = '<неподдерживаемый тип>';
        }
      } catch (e) {
        value = `<ошибка: ${e}>`;
      }
      
      console.log(`   ${col.name}: ${value}`);
    }
    
    console.log('\n✅ Файл валиден и может быть прочитан ClickHouse');
    
  } catch (error) {
    console.log(`❌ ОШИБКА ПАРСИНГА: ${error}\n`);
  }
}

// Главная функция
function main() {
  console.log('ClickHouse Native Format Diagnostic Tool');
  console.log('='.repeat(70));
  
  const files = ['./logs.native', './metrics.native'];
  
  files.forEach(file => {
    analyzeNativeFile(file);
  });
  
  console.log(`\n${'='.repeat(70)}`);
  console.log('✅ ДИАГНОСТИКА ЗАВЕРШЕНА');
  console.log('='.repeat(70));
}

main();