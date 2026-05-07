import {
	JsonStore,
	SqlStore,
	StoreControllerAbstract,
	StoreType,
} from "back-core";
import { RequestRequirementsStoreService } from "./requirements/service";
import { RequestsStoreService } from "./requests/service";
import requestsMigrations from "./requests/migrations";

export class StoresController extends StoreControllerAbstract {
  public requests: RequestsStoreService;
  public requirements: RequestRequirementsStoreService;

  constructor(protected msName: string) {
    super(msName);
  }

  async init() {
    const requirementsStore = await this.addStore(
      "requirements",
      StoreType.JSON,
      [],
    );
    const requestsStore = await this.addStore(
      "requests",
      StoreType.SQL,
      requestsMigrations,
    );
    this.requirements = new RequestRequirementsStoreService(
      requirementsStore as JsonStore,
    );
    this.requests = new RequestsStoreService(
      requestsStore as SqlStore,
      this.requirements,
    );
    await this.startAll();
    await this.migrateAll();
    await this.requirements.seedBundledDefaults();
  }

  async destroy() {
    await this.closeAll();
  }
}
