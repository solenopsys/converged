// Auto-generated package
import { createHttpClient } from "nrpc";

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

export const metadata = {
  "interfaceName": "ReviewsService",
  "serviceName": "reviews",
  "filePath": "services/business/reviews.ts",
  "methods": [
    {
      "name": "createReview",
      "parameters": [
        {
          "name": "input",
          "type": "ReviewInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewId",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getReview",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Review | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listReviews",
      "parameters": [
        {
          "name": "params",
          "type": "PaginationParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<Review>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "deleteReview",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewId",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "boolean",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    }
  ],
  "types": [
    {
      "name": "ReviewId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "Review",
      "kind": "type",
      "definition": "{\n  id: ReviewId;\n  author: string;\n  text: string;\n  rating: number;\n  createdAt: ISODateString;\n}"
    },
    {
      "name": "ReviewInput",
      "kind": "type",
      "definition": "{\n  author: string;\n  text: string;\n  rating: number;\n}"
    },
    {
      "name": "PaginationParams",
      "kind": "type",
      "definition": "{\n  offset: number;\n  limit: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n  items: T[];\n  totalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ReviewsService {
  createReview(input: ReviewInput): Promise<ReviewId>;
  getReview(id: ReviewId): Promise<Review | any>;
  listReviews(params: PaginationParams): Promise<PaginatedResult<Review>>;
  deleteReview(id: ReviewId): Promise<boolean>;
}

// Client interface
export interface ReviewsServiceClient {
  createReview(input: ReviewInput): Promise<ReviewId>;
  getReview(id: ReviewId): Promise<Review | any>;
  listReviews(params: PaginationParams): Promise<PaginatedResult<Review>>;
  deleteReview(id: ReviewId): Promise<boolean>;
}

// Factory function
export function createReviewsServiceClient(
  config?: { baseUrl?: string },
): ReviewsServiceClient {
  return createHttpClient<ReviewsServiceClient>(metadata, config);
}

// Ready-to-use client
export const reviewsClient = createReviewsServiceClient();
