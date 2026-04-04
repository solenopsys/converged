import { StoreControllerAbstract, StoreType, SqlStore } from "back-core";
import communityMigrations from "./community/migrations";
import { CommunityStoreService } from "./community/service";

export class StoresController extends StoreControllerAbstract {
  public community: CommunityStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const communityStore = await this.addStore(
      "community",
      StoreType.SQL,
      communityMigrations,
    );

    this.community = new CommunityStoreService(communityStore as SqlStore);

    await this.startAll();
    await this.migrateAll();
  }

  async destroy() {
    await this.closeAll();
  }
}
