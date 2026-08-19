export type ReviewId = string;
export type ISODateString = string;

export type Review = {
  id: ReviewId;
  author: string;
  text: string;
  rating: number;
  createdAt: ISODateString;
};

export type ReviewInput = {
  author: string;
  text: string;
  rating: number;
};

export type PaginationParams = {
  offset: number;
  limit: number;
};

export type PaginatedResult<T> = {
  items: T[];
  totalCount?: number;
};

export interface ReviewsService {
  createReview(input: ReviewInput): Promise<ReviewId>;
  getReview(id: ReviewId): Promise<Review | null>;
  listReviews(params: PaginationParams): Promise<PaginatedResult<Review>>;
  deleteReview(id: ReviewId): Promise<boolean>;
}
