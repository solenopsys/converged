import { SqlStore } from "back-core";
import type {
  CommandLayout,
  SavedWindow,
  UserEnvironment,
} from "../../types";

type UserEnvironmentRow = {
  userId: string;
  windows: string;
  commandLayout: string;
  updatedAt: string;
};

const emptyCommandLayout = (): CommandLayout => ({
  pinned: [],
  hidden: [],
  order: [],
});

const emptyEnvironment = (): UserEnvironment => ({
  windows: [],
  commands: emptyCommandLayout(),
  updatedAt: new Date(0).toISOString(),
});

export class UsersStoreService {
  constructor(private store: SqlStore) {}

  async get(userId: string): Promise<UserEnvironment> {
    const row = await this.store.db
      .selectFrom("user_environment")
      .selectAll()
      .where("userId", "=", userId)
      .executeTakeFirst() as UserEnvironmentRow | undefined;
    return row ? this.deserialize(row) : emptyEnvironment();
  }

  async saveWindows(userId: string, windows: SavedWindow[]): Promise<UserEnvironment> {
    const current = await this.get(userId);
    return this.save(userId, { ...current, windows });
  }

  async saveCommandLayout(
    userId: string,
    commands: CommandLayout,
  ): Promise<UserEnvironment> {
    const current = await this.get(userId);
    return this.save(userId, { ...current, commands });
  }

  private async save(userId: string, environment: UserEnvironment): Promise<UserEnvironment> {
    const updatedAt = new Date().toISOString();
    const row = {
      userId,
      windows: JSON.stringify(environment.windows),
      commandLayout: JSON.stringify(environment.commands),
      updatedAt,
    };
    const existing = await this.store.db
      .selectFrom("user_environment")
      .select("userId")
      .where("userId", "=", userId)
      .executeTakeFirst();

    if (existing) {
      await this.store.db
        .updateTable("user_environment")
        .set(row)
        .where("userId", "=", userId)
        .execute();
    } else {
      await this.store.db.insertInto("user_environment").values(row).execute();
    }

    return { ...environment, updatedAt };
  }

  private deserialize(row: UserEnvironmentRow): UserEnvironment {
    try {
      const windows = JSON.parse(row.windows) as SavedWindow[];
      const commands = JSON.parse(row.commandLayout) as CommandLayout;
      return {
        windows: Array.isArray(windows) ? windows : [],
        commands: {
          pinned: Array.isArray(commands?.pinned) ? commands.pinned : [],
          hidden: Array.isArray(commands?.hidden) ? commands.hidden : [],
          order: Array.isArray(commands?.order) ? commands.order : [],
        },
        updatedAt: row.updatedAt,
      };
    } catch {
      return emptyEnvironment();
    }
  }
}
