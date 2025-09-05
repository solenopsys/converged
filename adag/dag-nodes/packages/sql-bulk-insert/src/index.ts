import { type INode } from "dag-api";
import { type Provider, getProvidersPool, evaluateJsonPathString } from "dag-api";

export default class BulkInsertNode implements INode {
   public scope!: string;

   constructor(
       public name: string,
       private tableName: string,
       private columnMapping: Record<string, string>, // { "id": "$.id", "name": "$.user_name" }
       private provider: string,
       private updateOnConflict: boolean 
   ) {}

   async execute(data: unknown): Promise<any> {
       console.log(`Bulk inserting into ${this.tableName}`);
       
       const records = Array.isArray(data) ? data : [data];
       if (records.length === 0) return { inserted: 0 };

       const columns = Object.keys(this.columnMapping);
       
       // Формируем placeholders для всех записей
       const placeholders = records.map((_, index) => {
           const offset = index * columns.length;
           const params = columns.map((_, colIndex) => `$${offset + colIndex + 1}`);
           return `(${params.join(', ')})`;
       }).join(', ');

       // Извлекаем значения из каждого объекта
       const values: any[] = [];
       for (const record of records) {
           for (const column of columns) {
               const jsonPath = this.columnMapping[column];
               const value = await evaluateJsonPathString(record, jsonPath);
               values.push(this.normalize(value));
           }
       }

       const sql = this.buildInsertSQL(columns, placeholders);
       
       const realProvider: Provider = await getProvidersPool().getOrCreate(this.provider);
       await realProvider.invoke("query", { sql, params: values });
       
       console.log(`Inserted ${records.length} records`);
       return { inserted: records.length };
   }

   private buildInsertSQL(columns: string[], placeholders: string): string {
       const columnList = columns.join(', ');
       let sql = `INSERT INTO ${this.tableName} (${columnList}) VALUES ${placeholders}`;
       
       if (this.updateOnConflict) {
           const updates = columns.map(col => `${col} = EXCLUDED.${col}`).join(', ');
           sql += ` ON CONFLICT DO UPDATE SET ${updates}`;
       } else {
           sql += ' ON CONFLICT DO NOTHING';
       }
       
       return sql;
   }

   private normalize(v: unknown) {
       if (typeof v === "string" && /^\d+$/.test(v)) return Number(v);
       return v;
   }
}