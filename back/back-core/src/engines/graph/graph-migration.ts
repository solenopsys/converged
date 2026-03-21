import { Migration } from "../../migrations";
import { GraphStore } from "./graph-store";

export abstract class GraphMigration implements Migration {
  id: string;

  constructor(id: string, protected store: GraphStore) {
    this.id = id;
  }

  abstract up(): Promise<void>;
  abstract down(): Promise<void>;
}
