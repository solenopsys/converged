import type { SqlStore } from "back-core";
import type {
	CommandLayout,
	SavedWindow,
	SurfaceLayout,
	UserEnvironment,
} from "../../types";

type UserEnvironmentRow = {
	userId: string;
	windows: string;
	commandLayout: string;
	surfaceLayout: string;
	updatedAt: string;
};

/** More surfaces than any product declares; a list past it is not a preference. */
const MAX_SURFACES = 200;

const emptyCommandLayout = (): CommandLayout => ({
	pinned: [],
	hidden: [],
	order: [],
});

const emptySurfaceLayout = (): SurfaceLayout => ({ pinned: [], unpinned: [] });

const emptyEnvironment = (): UserEnvironment => ({
	windows: [],
	commands: emptyCommandLayout(),
	surfaces: emptySurfaceLayout(),
	updatedAt: new Date(0).toISOString(),
});

const ids = (value: unknown): string[] =>
	Array.isArray(value)
		? [
				...new Set(
					value
						.filter((item): item is string => typeof item === "string")
						.map((item) => item.trim())
						.filter(Boolean),
				),
			].slice(0, MAX_SURFACES)
		: [];

/**
 * A surface is either pinned or unpinned, never both. The browser sends the
 * whole layout on every toggle, so a contradiction can only be a client bug —
 * pinned wins because losing a tab the user just pinned is the visible failure.
 */
export function normalizeSurfaceLayout(value: unknown): SurfaceLayout {
	const layout = (value ?? {}) as Partial<SurfaceLayout>;
	const pinned = ids(layout.pinned);
	const kept = new Set(pinned);
	return {
		pinned,
		unpinned: ids(layout.unpinned).filter((id) => !kept.has(id)),
	};
}

const parse = (raw: string | undefined): unknown => {
	if (!raw) return undefined;
	try {
		return JSON.parse(raw);
	} catch {
		return undefined;
	}
};

export class UsersStoreService {
	constructor(private store: SqlStore) {}

	async get(userId: string): Promise<UserEnvironment> {
		const row = (await this.store.db
			.selectFrom("user_environment")
			.selectAll()
			.where("userId", "=", userId)
			.executeTakeFirst()) as UserEnvironmentRow | undefined;
		return row ? this.deserialize(row) : emptyEnvironment();
	}

	async saveWindows(
		userId: string,
		windows: SavedWindow[],
	): Promise<UserEnvironment> {
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

	async saveSurfaceLayout(
		userId: string,
		surfaces: SurfaceLayout,
	): Promise<UserEnvironment> {
		const current = await this.get(userId);
		return this.save(userId, {
			...current,
			surfaces: normalizeSurfaceLayout(surfaces),
		});
	}

	private async save(
		userId: string,
		environment: UserEnvironment,
	): Promise<UserEnvironment> {
		const updatedAt = new Date().toISOString();
		const row = {
			userId,
			windows: JSON.stringify(environment.windows),
			commandLayout: JSON.stringify(environment.commands),
			surfaceLayout: JSON.stringify(environment.surfaces),
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
		// Each column fails on its own: a damaged window list is no reason to drop
		// the surfaces a user pinned.
		const windows = parse(row.windows);
		const commands = parse(row.commandLayout) as
			| Partial<CommandLayout>
			| undefined;
		return {
			windows: Array.isArray(windows) ? (windows as SavedWindow[]) : [],
			commands: {
				pinned: Array.isArray(commands?.pinned) ? commands.pinned : [],
				hidden: Array.isArray(commands?.hidden) ? commands.hidden : [],
				order: Array.isArray(commands?.order) ? commands.order : [],
			},
			surfaces: normalizeSurfaceLayout(parse(row.surfaceLayout)),
			updatedAt: row.updatedAt,
		};
	}
}
