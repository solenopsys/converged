import { Migration } from "../../migrations";
import { SqlStore } from "./sql-store";

export abstract class SqlMigration implements Migration {
    id: string;
  
    constructor(id: string,protected store: SqlStore) {
        this.id = id;
    }
  
    abstract up(): Promise<void>;
    abstract down(): Promise<void>;
  }