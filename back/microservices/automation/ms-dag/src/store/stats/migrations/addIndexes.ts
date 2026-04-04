import { SqlStore, SqlMigration } from "back-core";

export default class extends SqlMigration {
  constructor(store: SqlStore) {
    super("add_stats_indexes", store);
  }

  async up(): Promise<void> {
    // process table indexes for listing and filtered stats
    await this.store.db.schema
      .createIndex("idx_process_created_at")
      .ifNotExists()
      .on("process")
      .column("created_at")
      .execute();

    await this.store.db.schema
      .createIndex("idx_process_workflow_created_at")
      .ifNotExists()
      .on("process")
      .columns(["workflow_id", "created_at"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_process_status_created_at")
      .ifNotExists()
      .on("process")
      .columns(["status", "created_at"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_process_workflow_status_created_at")
      .ifNotExists()
      .on("process")
      .columns(["workflow_id", "status", "created_at"])
      .execute();

    // nodes table indexes for list/filter/order
    await this.store.db.schema
      .createIndex("idx_nodes_created_at")
      .ifNotExists()
      .on("nodes")
      .column("created_at")
      .execute();

    await this.store.db.schema
      .createIndex("idx_nodes_process_created_at")
      .ifNotExists()
      .on("nodes")
      .columns(["process_id", "created_at"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_nodes_process_state_created_at")
      .ifNotExists()
      .on("nodes")
      .columns(["process_id", "state", "created_at"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_nodes_node_created_at")
      .ifNotExists()
      .on("nodes")
      .columns(["node_id", "created_at"])
      .execute();

    await this.store.db.schema
      .createIndex("idx_nodes_state_created_at")
      .ifNotExists()
      .on("nodes")
      .columns(["state", "created_at"])
      .execute();
  }

  async down(): Promise<void> {
    await this.store.db.schema.dropIndex("idx_nodes_state_created_at").ifExists().execute();
    await this.store.db.schema.dropIndex("idx_nodes_node_created_at").ifExists().execute();
    await this.store.db.schema.dropIndex("idx_nodes_process_state_created_at").ifExists().execute();
    await this.store.db.schema.dropIndex("idx_nodes_process_created_at").ifExists().execute();
    await this.store.db.schema.dropIndex("idx_nodes_created_at").ifExists().execute();

    await this.store.db.schema
      .dropIndex("idx_process_workflow_status_created_at")
      .ifExists()
      .execute();
    await this.store.db.schema.dropIndex("idx_process_status_created_at").ifExists().execute();
    await this.store.db.schema
      .dropIndex("idx_process_workflow_created_at")
      .ifExists()
      .execute();
    await this.store.db.schema.dropIndex("idx_process_created_at").ifExists().execute();
  }
}
