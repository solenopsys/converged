import { Migration } from "../../migrations";
import { VectorStore } from "./vector-store";

export abstract class VectorMigration implements Migration {
  id: string;

  constructor(id: string, protected store: VectorStore) {
    this.id = id;
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}
