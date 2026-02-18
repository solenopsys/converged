import type {
  PartnersService,
  Partner,
  PartnerInput,
  PartnerUpdate,
  PartnerId,
  PartnerListParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "partners-ms";

export class PartnersServiceImpl implements PartnersService {
  stores: StoresController;

  constructor() {
    this.init();
  }

  async init() {
    this.stores = new StoresController(MS_ID);
    await this.stores.init();
  }

  createPartner(input: PartnerInput): Promise<PartnerId> {
    return this.stores.partners.createPartner(input);
  }

  getPartner(id: PartnerId): Promise<Partner | undefined> {
    return this.stores.partners.getPartner(id);
  }

  updatePartner(id: PartnerId, patch: PartnerUpdate): Promise<void> {
    return this.stores.partners.updatePartner(id, patch);
  }

  deletePartner(id: PartnerId): Promise<boolean> {
    return this.stores.partners.deletePartner(id);
  }

  listPartners(params: PartnerListParams): Promise<PaginatedResult<Partner>> {
    return this.stores.partners.listPartners(params);
  }
}
