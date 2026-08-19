import type {
  CommandLayout,
  EnvironmentService,
  SavedWindow,
  UserEnvironment,
} from "./types";
import { Access, getCurrentWorkspaceContext } from "nrpc";
import { StoresController } from "./stores";

/**
 * Personal UI state. Permissions and the physical microfrontend delivery do
 * not live here: those are resolved by ms-access and deployment config.
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
      this.stores = new StoresController("environment-ms");
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
}

export default EnvironmentServiceImpl;
