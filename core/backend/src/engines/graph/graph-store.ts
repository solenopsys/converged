import { StorageConnection, Row } from "bun-transport";
import { Store } from "../../stores";
import { Migration, Migrator } from "../../migrations";
import { TransportMigrationStateStorage } from "../transport/transport-driver";

export class GraphStore implements Store {
  constructor(
    private conn: StorageConnection,
    private ms: string,
    private storeName: string,
    private migrations: (new (store: Store) => Migration)[] = [],
  ) {}

  async open(): Promise<void> {
    this.conn.open(this.ms, this.storeName);
  }

  async close(): Promise<void> {
    // Transport stores are shared by all clients of the storage process.
    // A service shutdown must not close the global store.
  }

  async migrate(): Promise<void> {
    const stateStorage = new TransportMigrationStateStorage(
      this.conn,
      this.ms,
      this.storeName,
    );
    const migrations = this.migrations.map((M) => new M(this));
    const migrator = new Migrator(migrations, stateStorage);
    await migrator.up();
  }

  exec(cypher: string): void {
    this.conn.execSql(this.ms, this.storeName, cypher);
  }

  query(cypher: string): Row[] {
    return this.conn.querySql(this.ms, this.storeName, cypher);
  }
}
