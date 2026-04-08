import { type INode, type Provider } from "../dag-api";
import { evaluateJsonPathString } from "back-core";
import { getProvidersPool } from "../providers";

export default class BulkInsertNode implements INode {
  public scope!: string;

  constructor(
    public name: string,
    private tableName: string,
    private columnMapping: Record<string, string>, // { "id": "$.id", "name": "$.user_name" }
    private provider: string,
    private updateOnConflict: boolean
  ) {}

  async execute(data:{array: any[]}): Promise<any> {
    const arr=data.array;
    console.log(`Bulk inserting into ${this.tableName}`);
    console.log(`Data length: ${arr ? arr.length : "null"}`);

    if (!arr || arr.length === 0) return { inserted: 0 };

    const columns = Object.keys(this.columnMapping);
    if (columns.length === 0) return { inserted: 0 };
    console.log(`Columns: ${columns.join(", ")}`);

    // Собираем значения в плоский массив по порядку колонок (row-major)
    const allValues: any[] = [];
    for (let i = 0; i < arr.length; i++) {
      const record = arr[i];
      // console.log(`Processing record ${i + 1}/${data.length}:`, record);
      for (let j = 0; j < columns.length; j++) {
        const column = columns[j];
        const jsonPath = this.columnMapping[column];
        // console.log(`  Column: ${column}, JSON Path: ${jsonPath}`);

        let value: unknown;
        try {
          value = await evaluateJsonPathString(record, jsonPath);
        } catch (error: any) {
          console.log(`  Error extracting ${column}: ${error?.message ?? error}`);
          value = null;
        }

        const normalizedValue = this.normalize(value);
        // console.log(`  Extracted value: ${value} -> ${normalizedValue}`);
        allValues.push(normalizedValue);
      }
    }

    // БАТЧИРОВАНИЕ: ограничим кол-во параметров на запрос (Postgres лимит ~65535)
    const maxParamsPerQuery = 60000;
    const paramsPerRow = columns.length;
    const maxRowsPerBatch = Math.max(1, Math.floor(maxParamsPerQuery / paramsPerRow));

    const totalRows = arr.length;
    let totalInserted = 0;

    const realProvider: Provider = await getProvidersPool().getOrCreate(this.provider);

    for (let offset = 0; offset < totalRows; offset += maxRowsPerBatch) {
      const rowsInThisBatch = Math.min(maxRowsPerBatch, totalRows - offset);

      // Массив параметров для батча
      const batchParams = allValues.slice(offset * paramsPerRow, (offset + rowsInThisBatch) * paramsPerRow);

      // Генерируем placeholders c позиционными плейсхолдерами PostgreSQL: $1, $2, ...
      let paramIndex = 1;
      const placeholders = Array.from({ length: rowsInThisBatch }, () => {
        const row = Array.from({ length: paramsPerRow }, () => `$${paramIndex++}`);
        return `(${row.join(", ")})`;
      }).join(", ");

      const sql = this.buildInsertSQL(columns, placeholders);
      // console.log(`Generated SQL: ${sql}`);
      // console.log(`Parameters (${batchParams.length}):`, batchParams);

      console.log(`Executing batch: rows=${rowsInThisBatch}, params=${batchParams.length}`);
      await realProvider.invoke("query", { sql, params: batchParams });
      totalInserted += rowsInThisBatch;
    }

    console.log(`Successfully inserted ${totalInserted} records`);
    return { inserted: totalInserted };
  }

  private buildInsertSQL(columns: string[], placeholders: string): string {
    const quotedTable = this.quoteIdent(this.tableName);
    const quotedCols = columns.map((c) => this.quoteIdent(c)).join(", ");
    let sql = `INSERT INTO ${quotedTable} (${quotedCols}) VALUES ${placeholders}`;

    if (this.updateOnConflict) {
      // Предполагаем, что первая колонка — PK/уникальный индекс
      const primaryKey = this.quoteIdent(columns[0]);
      const updates = columns
        .slice(1)
        .map((col) => `${this.quoteIdent(col)} = EXCLUDED.${this.quoteIdent(col)}`)
        .join(", ");

      if (updates.length > 0) {
        sql += ` ON CONFLICT (${primaryKey}) DO UPDATE SET ${updates}`;
      } else {
        // Если единственная колонка — PK, то при конфликте просто игнорируем
        sql += ` ON CONFLICT (${primaryKey}) DO NOTHING`;
      }
    } else {
      // Самый безопасный и универсальный вариант — без указания цели конфликта
      // (применимо к любому конфликту уникальности)
      sql += ` ON CONFLICT DO NOTHING`;
    }

    return sql;
  }

  private normalize(value: unknown) {
    if (value === null || value === undefined) return null;

    // Преобразуем только "чисто цифровые" строки в Number (остальное оставляем как есть)
    if (typeof value === "string" && /^\d+$/.test(value)) {
      // ВНИМАНИЕ: очень большие числа могут выйти за пределы безопасного int JS
      // Для таких случаев лучше хранить как строку или использовать BigInt (если провайдер поддерживает)
      const num = Number(value);
      return Number.isSafeInteger(num) ? num : value;
    }

    return value;
  }

  // Простая и безопасная кавычка идентификаторов для Postgres
  private quoteIdent(ident: string): string {
    // Запрещаем опасные символы полностью (минимальная валидация)
    // Разрешаем буквы/цифры/подчёркивания/точки (для схемы: schema.table)
    if (!/^[A-Za-z0-9_\.]+$/.test(ident)) {
      throw new Error(`Invalid identifier: ${ident}`);
    }
    // Поддержка schema.table: экранируем каждую часть отдельно
    const parts = ident.split(".");
    return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
  }
}
