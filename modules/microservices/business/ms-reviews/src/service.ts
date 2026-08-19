import type {
  ReviewsService,
  Review,
  ReviewId,
  ReviewInput,
  PaginationParams,
  PaginatedResult,
} from "./types";
import { StoresController } from "./stores";

const MS_ID = "reviews-ms";

export class ReviewsServiceImpl implements ReviewsService {
  private stores: StoresController;
  private initPromise?: Promise<void>;

  constructor() {
    this.init();
  }

  private async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      this.stores = new StoresController(MS_ID);
      await this.stores.init();
    })();

    return this.initPromise;
  }

  private async ready(): Promise<void> {
    await this.init();
  }

  async createReview(input: ReviewInput): Promise<ReviewId> {
    await this.ready();
    return this.stores.metadata.create(input);
  }

  async getReview(id: ReviewId): Promise<Review | null> {
    await this.ready();
    return this.stores.metadata.get(id);
  }

  async listReviews(
    params: PaginationParams,
  ): Promise<PaginatedResult<Review>> {
    await this.ready();
    return this.stores.metadata.list(params);
  }

  async deleteReview(id: ReviewId): Promise<boolean> {
    await this.ready();
    return this.stores.metadata.delete(id);
  }
}

export default ReviewsServiceImpl;
