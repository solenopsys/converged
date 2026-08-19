import { Migration } from "../../migrations";
import { ColumnStore } from "./column-store";

export abstract class ColumnMigration implements Migration {
  id: string;

  constructor(id: string, protected store: ColumnStore) {
    this.id = id;
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}
