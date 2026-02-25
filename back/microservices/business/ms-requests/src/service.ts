import type {
  RequestsService,
  Request,
  RequestInput,
  RequestId,
  RequestListParams,
  PaginatedResult,
  RequestStatus,
  RequestProcessingEntry,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "requests-ms";

export class RequestsServiceImpl implements RequestsService {
  stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  createRequest(input: RequestInput): Promise<RequestId> {
    return this.stores.requests.createRequest(input);
  }

  getRequest(id: RequestId): Promise<Request | undefined> {
    return this.stores.requests.getRequest(id);
  }

  listRequests(params: RequestListParams): Promise<PaginatedResult<Request>> {
    return this.stores.requests.listRequests(params);
  }

  updateStatus(
    id: RequestId,
    status: RequestStatus,
    actor: string,
    comment?: string,
  ): Promise<void> {
    return this.stores.requests.updateStatus(id, status, actor, comment);
  }

  listProcessing(requestId: RequestId): Promise<RequestProcessingEntry[]> {
    return this.stores.requests.listProcessing(requestId);
  }
}
