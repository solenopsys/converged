import { Access, getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";
import type {
	CommandLayout,
	EnvironmentService,
	SavedWindow,
	SurfaceLayout,
	UserEnvironment,
} from "./types";

/**
 * Personal UI state. Permissions and the physical surface delivery do
 * not live here: those are resolved by rp-access and deployment config.
 */
@Access("user")
export class EnvironmentServiceImpl implements EnvironmentService {
	private stores: StoresController;
	private initPromise?: Promise<void>;

	constructor() {
		this.init();
	}

	private async init(): Promise<void> {
		if (this.initPromise) return this.initPromise;
		this.initPromise = (async () => {
			this.stores = new StoresController("rp-environment");
			await this.stores.init();
		})();
		return this.initPromise;
	}

	private async ready(): Promise<void> {
		await this.init();
	}

	private currentUserId(): string {
		const userId = getCurrentWorkspaceContext()?.user?.trim();
		if (!userId) throw new Error("environment requires a session user");
		return userId;
	}

	async getCurrent(): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.get(this.currentUserId());
	}

	async saveWindows(windows: SavedWindow[]): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.saveWindows(this.currentUserId(), windows);
	}

	async saveCommandLayout(layout: CommandLayout): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.saveCommandLayout(this.currentUserId(), layout);
	}

	async saveSurfaceLayout(layout: SurfaceLayout): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.saveSurfaceLayout(this.currentUserId(), layout);
	}

	async saveLayout(
		scope: string,
		layout: SurfaceLayout,
	): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.saveLayout(this.currentUserId(), scope, layout);
	}

	async saveLocale(locale: string): Promise<UserEnvironment> {
		await this.ready();
		return this.stores.users.saveLocale(this.currentUserId(), locale);
	}
}

export default EnvironmentServiceImpl;
