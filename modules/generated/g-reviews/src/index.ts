// Auto-generated native NRPC package
import {
  createCrullerTransportClient,
  type CrullerTransportClientConfig,
  type ServiceMetadata,
} from "nrpc";

export type ReviewId = string;

export type ReviewInviteId = string;

export type OrderId = string;

export type RequestId = string;

export type ISODateString = string;

export type ReviewStatus = "pending" | "published" | "rejected";

export type ReviewSource = "site" | "invite" | "staff" | "external";

export type ReviewInviteStatus = | "queued"
	| "sent"
	| "opened"
	| "answered"
	| "expired"
	| "failed";

export type Review = {
	id: ReviewId;
	/** The work this is about. Set whenever the review came through a link. */
	orderId?: OrderId;
	requestId?: RequestId;
	author: string;
	/** How to reach the author back — an email, usually. Never shown publicly. */
	contact?: string;
	text: string;
	rating: number;
	status: ReviewStatus;
	source?: ReviewSource;
	reply?: string;
	repliedAt?: ISODateString;
	repliedBy?: string;
	/**
	 * Where the author went to say it again in public, if they did.
	 *
	 * The shop cannot read Google's copy of the review, so this is the only
	 * trace that the positive flow reached the outside — which is the number
	 * the whole of contour 3 is judged by.
	 */
	externalPlatform?: string;
	externalUrl?: string;
	publishedAt?: ISODateString;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type ReviewInput = {
	author: string;
	text: string;
	rating: number;
	orderId?: OrderId;
	requestId?: RequestId;
	contact?: string;
	source?: ReviewSource;
	status?: ReviewStatus;
};

export type ReviewPatch = {
	author?: string;
	text?: string;
	rating?: number;
	contact?: string;
	externalPlatform?: string;
	externalUrl?: string;
};

export type ReviewInvite = {
	id: ReviewInviteId;
	orderId: OrderId;
	/** Unguessable; knowing it is the authorisation to open and answer the form. */
	token: string;
	contact: string;
	lang?: string;
	status: ReviewInviteStatus;
	sentAt?: ISODateString;
	openedAt?: ISODateString;
	answeredAt?: ISODateString;
	expiresAt: ISODateString;
	followupCount: number;
	lastFollowupAt?: ISODateString;
	/** The review that came out of this link, once one did. */
	reviewId?: ReviewId;
	error?: string;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

export type ReviewInviteInput = {
	orderId: OrderId;
	contact: string;
	lang?: string;
	/** Overrides `ReviewSettings.inviteTtlDays` for this one link. */
	ttlDays?: number;
};

export type ReviewInvitePatch = {
	status?: ReviewInviteStatus;
	sentAt?: ISODateString;
	lastFollowupAt?: ISODateString;
	followupCount?: number;
	error?: string;
};

export type ReviewInviteView = {
	orderId: OrderId;
	status: ReviewInviteStatus;
	expiresAt: ISODateString;
	/** Already answered or expired — the form shows a message instead of a field. */
	usable: boolean;
	lang?: string;
};

export type ReviewSubmission = {
	author?: string;
	text: string;
	rating: number;
	contact?: string;
	/** Set when the author then went on to an external platform. */
	externalPlatform?: string;
};

export type ReviewPlatform = {
	id: string;
	label: string;
	url: string;
	shareText?: string;
	enabled?: boolean;
};

export type ReviewSettings = {
	platforms: ReviewPlatform[];
	positiveThreshold: number;
	/** Hours after an order completes before the first ask goes out. */
	requestDelayHours: number;
	/** Days of silence before the single chase. */
	followupDelayDays: number;
	maxFollowups: number;
	inviteTtlDays: number;
	/** Base of the personal link; the token is appended by the sender. */
	publicFormUrl: string;
	/** Sender address used by the outreach workflow. */
	fromAddress?: string;
	updatedAt?: ISODateString;
};

export type ReviewSettingsPatch = Partial<Omit<ReviewSettings, "updatedAt">>;

export type FilterObject = Record<string, unknown>;

export type SelectionFieldDescriptor = {
	id: string;
	label: string;
	valueType: "string" | "number" | "boolean" | "date" | "enum";
	operators: string[];
};

export type SelectionDescriptor = {
	objectType: string;
	title: string;
	fields: SelectionFieldDescriptor[];
	filterExample?: FilterObject;
	revision?: string;
};

export type SelectionStats = { totalCount: number };

export type ReviewListParams = {
	offset: number;
	limit: number;
	status?: ReviewStatus;
	rating?: number;
	minRating?: number;
	orderId?: OrderId;
	source?: ReviewSource;
	/** True: only reviews nobody has answered yet. */
	unanswered?: boolean;
	filter?: FilterObject;
};

export type ReviewInviteListParams = {
	offset: number;
	limit: number;
	orderId?: OrderId;
	/** The workflow's way of asking "which of these orders were already asked". */
	orderIds?: OrderId[];
	status?: ReviewInviteStatus;
};

export type ReviewStatusCount = {
	status: ReviewStatus;
	count: number;
};

export type ReviewRatingCount = {
	rating: number;
	count: number;
};

export type ReviewFunnel = {
	invited: number;
	sent: number;
	opened: number;
	answered: number;
	expired: number;
};

export type ReviewsDashboard = {
	total: number;
	averageRating: number;
	statusCounts: ReviewStatusCount[];
	ratingCounts: ReviewRatingCount[];
	funnel: ReviewFunnel;
	/** Share of answered links whose author also went to an external platform. */
	externalSharePercent: number;
	awaitingReply: number;
	pending: number;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export const metadata: ServiceMetadata = {
  "interfaceName": "ReviewsService",
  "serviceName": "reviews",
  "filePath": "business/reviews.ts",
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
          "type": "ReviewListParams",
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
      "name": "patchReview",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "ReviewPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Review",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "setStatus",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "status",
          "type": "ReviewStatus",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Review",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "replyToReview",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "reply",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "Review",
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
    },
    {
      "name": "describeSelection",
      "parameters": [
        {
          "name": "objectType",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "SelectionDescriptor",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "inspectReviews",
      "parameters": [
        {
          "name": "filter",
          "type": "FilterObject",
          "optional": true,
          "isArray": false
        }
      ],
      "returnType": "SelectionStats",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getReviewsDashboard",
      "parameters": [],
      "returnType": "ReviewsDashboard",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "createInvite",
      "parameters": [
        {
          "name": "input",
          "type": "ReviewInviteInput",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewInvite",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "listInvites",
      "parameters": [
        {
          "name": "params",
          "type": "ReviewInviteListParams",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "PaginatedResult<ReviewInvite>",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "patchInvite",
      "parameters": [
        {
          "name": "id",
          "type": "ReviewInviteId",
          "optional": false,
          "isArray": false
        },
        {
          "name": "patch",
          "type": "ReviewInvitePatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "void",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "findInvitesToFollowUp",
      "parameters": [
        {
          "name": "days",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "maxFollowups",
          "type": "number",
          "optional": false,
          "isArray": false
        },
        {
          "name": "limit",
          "type": "number",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewInvite",
      "isAsync": true,
      "returnTypeIsArray": true,
      "isAsyncIterable": false
    },
    {
      "name": "getInviteByToken",
      "parameters": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewInviteView | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "markInviteOpened",
      "parameters": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewInviteView | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "submitByToken",
      "parameters": [
        {
          "name": "token",
          "type": "string",
          "optional": false,
          "isArray": false
        },
        {
          "name": "submission",
          "type": "ReviewSubmission",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewId | any",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "getSettings",
      "parameters": [],
      "returnType": "ReviewSettings",
      "isAsync": true,
      "returnTypeIsArray": false,
      "isAsyncIterable": false
    },
    {
      "name": "saveSettings",
      "parameters": [
        {
          "name": "patch",
          "type": "ReviewSettingsPatch",
          "optional": false,
          "isArray": false
        }
      ],
      "returnType": "ReviewSettings",
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
      "name": "ReviewInviteId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "OrderId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "RequestId",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ISODateString",
      "kind": "type",
      "definition": "string"
    },
    {
      "name": "ReviewStatus",
      "kind": "type",
      "definition": "\"pending\" | \"published\" | \"rejected\""
    },
    {
      "name": "ReviewSource",
      "kind": "type",
      "definition": "\"site\" | \"invite\" | \"staff\" | \"external\""
    },
    {
      "name": "ReviewInviteStatus",
      "kind": "type",
      "definition": "| \"queued\"\n\t| \"sent\"\n\t| \"opened\"\n\t| \"answered\"\n\t| \"expired\"\n\t| \"failed\""
    },
    {
      "name": "Review",
      "kind": "type",
      "definition": "{\n\tid: ReviewId;\n\t/** The work this is about. Set whenever the review came through a link. */\n\torderId?: OrderId;\n\trequestId?: RequestId;\n\tauthor: string;\n\t/** How to reach the author back — an email, usually. Never shown publicly. */\n\tcontact?: string;\n\ttext: string;\n\trating: number;\n\tstatus: ReviewStatus;\n\tsource?: ReviewSource;\n\treply?: string;\n\trepliedAt?: ISODateString;\n\trepliedBy?: string;\n\t/**\n\t * Where the author went to say it again in public, if they did.\n\t *\n\t * The shop cannot read Google's copy of the review, so this is the only\n\t * trace that the positive flow reached the outside — which is the number\n\t * the whole of contour 3 is judged by.\n\t */\n\texternalPlatform?: string;\n\texternalUrl?: string;\n\tpublishedAt?: ISODateString;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "ReviewInput",
      "kind": "type",
      "definition": "{\n\tauthor: string;\n\ttext: string;\n\trating: number;\n\torderId?: OrderId;\n\trequestId?: RequestId;\n\tcontact?: string;\n\tsource?: ReviewSource;\n\tstatus?: ReviewStatus;\n}"
    },
    {
      "name": "ReviewPatch",
      "kind": "type",
      "definition": "{\n\tauthor?: string;\n\ttext?: string;\n\trating?: number;\n\tcontact?: string;\n\texternalPlatform?: string;\n\texternalUrl?: string;\n}"
    },
    {
      "name": "ReviewInvite",
      "kind": "type",
      "definition": "{\n\tid: ReviewInviteId;\n\torderId: OrderId;\n\t/** Unguessable; knowing it is the authorisation to open and answer the form. */\n\ttoken: string;\n\tcontact: string;\n\tlang?: string;\n\tstatus: ReviewInviteStatus;\n\tsentAt?: ISODateString;\n\topenedAt?: ISODateString;\n\tansweredAt?: ISODateString;\n\texpiresAt: ISODateString;\n\tfollowupCount: number;\n\tlastFollowupAt?: ISODateString;\n\t/** The review that came out of this link, once one did. */\n\treviewId?: ReviewId;\n\terror?: string;\n\tcreatedAt: ISODateString;\n\tupdatedAt: ISODateString;\n}"
    },
    {
      "name": "ReviewInviteInput",
      "kind": "type",
      "definition": "{\n\torderId: OrderId;\n\tcontact: string;\n\tlang?: string;\n\t/** Overrides `ReviewSettings.inviteTtlDays` for this one link. */\n\tttlDays?: number;\n}"
    },
    {
      "name": "ReviewInvitePatch",
      "kind": "type",
      "definition": "{\n\tstatus?: ReviewInviteStatus;\n\tsentAt?: ISODateString;\n\tlastFollowupAt?: ISODateString;\n\tfollowupCount?: number;\n\terror?: string;\n}"
    },
    {
      "name": "ReviewInviteView",
      "kind": "type",
      "definition": "{\n\torderId: OrderId;\n\tstatus: ReviewInviteStatus;\n\texpiresAt: ISODateString;\n\t/** Already answered or expired — the form shows a message instead of a field. */\n\tusable: boolean;\n\tlang?: string;\n}"
    },
    {
      "name": "ReviewSubmission",
      "kind": "type",
      "definition": "{\n\tauthor?: string;\n\ttext: string;\n\trating: number;\n\tcontact?: string;\n\t/** Set when the author then went on to an external platform. */\n\texternalPlatform?: string;\n}"
    },
    {
      "name": "ReviewPlatform",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\turl: string;\n\tshareText?: string;\n\tenabled?: boolean;\n}"
    },
    {
      "name": "ReviewSettings",
      "kind": "type",
      "definition": "{\n\tplatforms: ReviewPlatform[];\n\tpositiveThreshold: number;\n\t/** Hours after an order completes before the first ask goes out. */\n\trequestDelayHours: number;\n\t/** Days of silence before the single chase. */\n\tfollowupDelayDays: number;\n\tmaxFollowups: number;\n\tinviteTtlDays: number;\n\t/** Base of the personal link; the token is appended by the sender. */\n\tpublicFormUrl: string;\n\t/** Sender address used by the outreach workflow. */\n\tfromAddress?: string;\n\tupdatedAt?: ISODateString;\n}"
    },
    {
      "name": "ReviewSettingsPatch",
      "kind": "type",
      "definition": "Partial<Omit<ReviewSettings, \"updatedAt\">>"
    },
    {
      "name": "FilterObject",
      "kind": "type",
      "definition": "Record<string, unknown>"
    },
    {
      "name": "SelectionFieldDescriptor",
      "kind": "type",
      "definition": "{\n\tid: string;\n\tlabel: string;\n\tvalueType: \"string\" | \"number\" | \"boolean\" | \"date\" | \"enum\";\n\toperators: string[];\n}"
    },
    {
      "name": "SelectionDescriptor",
      "kind": "type",
      "definition": "{\n\tobjectType: string;\n\ttitle: string;\n\tfields: SelectionFieldDescriptor[];\n\tfilterExample?: FilterObject;\n\trevision?: string;\n}"
    },
    {
      "name": "SelectionStats",
      "kind": "type",
      "definition": "{ totalCount: number }"
    },
    {
      "name": "ReviewListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\tstatus?: ReviewStatus;\n\trating?: number;\n\tminRating?: number;\n\torderId?: OrderId;\n\tsource?: ReviewSource;\n\t/** True: only reviews nobody has answered yet. */\n\tunanswered?: boolean;\n\tfilter?: FilterObject;\n}"
    },
    {
      "name": "ReviewInviteListParams",
      "kind": "type",
      "definition": "{\n\toffset: number;\n\tlimit: number;\n\torderId?: OrderId;\n\t/** The workflow's way of asking \"which of these orders were already asked\". */\n\torderIds?: OrderId[];\n\tstatus?: ReviewInviteStatus;\n}"
    },
    {
      "name": "ReviewStatusCount",
      "kind": "type",
      "definition": "{\n\tstatus: ReviewStatus;\n\tcount: number;\n}"
    },
    {
      "name": "ReviewRatingCount",
      "kind": "type",
      "definition": "{\n\trating: number;\n\tcount: number;\n}"
    },
    {
      "name": "ReviewFunnel",
      "kind": "type",
      "definition": "{\n\tinvited: number;\n\tsent: number;\n\topened: number;\n\tanswered: number;\n\texpired: number;\n}"
    },
    {
      "name": "ReviewsDashboard",
      "kind": "type",
      "definition": "{\n\ttotal: number;\n\taverageRating: number;\n\tstatusCounts: ReviewStatusCount[];\n\tratingCounts: ReviewRatingCount[];\n\tfunnel: ReviewFunnel;\n\t/** Share of answered links whose author also went to an external platform. */\n\texternalSharePercent: number;\n\tawaitingReply: number;\n\tpending: number;\n}"
    },
    {
      "name": "PaginatedResult",
      "kind": "type",
      "typeParameters": "<T>",
      "definition": "{\n\titems: T[];\n\ttotalCount?: number;\n}"
    }
  ]
};

// Server interface (to be implemented in microservice)
export interface ReviewsService {
  createReview(input: ReviewInput): Promise<ReviewId>;
  getReview(id: ReviewId): Promise<Review | any>;
  listReviews(params: ReviewListParams): Promise<PaginatedResult<Review>>;
  patchReview(id: ReviewId, patch: ReviewPatch): Promise<Review>;
  setStatus(id: ReviewId, status: ReviewStatus): Promise<Review>;
  replyToReview(id: ReviewId, reply: string): Promise<Review>;
  deleteReview(id: ReviewId): Promise<boolean>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectReviews(filter?: FilterObject): Promise<SelectionStats>;
  getReviewsDashboard(): Promise<ReviewsDashboard>;
  createInvite(input: ReviewInviteInput): Promise<ReviewInvite>;
  listInvites(params: ReviewInviteListParams): Promise<PaginatedResult<ReviewInvite>>;
  patchInvite(id: ReviewInviteId, patch: ReviewInvitePatch): Promise<void>;
  findInvitesToFollowUp(days: number, maxFollowups: number, limit: number): Promise<ReviewInvite[]>;
  getInviteByToken(token: string): Promise<ReviewInviteView | any>;
  markInviteOpened(token: string): Promise<ReviewInviteView | any>;
  submitByToken(token: string, submission: ReviewSubmission): Promise<ReviewId | any>;
  getSettings(): Promise<ReviewSettings>;
  saveSettings(patch: ReviewSettingsPatch): Promise<ReviewSettings>;
}

// Client interface
export interface ReviewsServiceClient {
  createReview(input: ReviewInput): Promise<ReviewId>;
  getReview(id: ReviewId): Promise<Review | any>;
  listReviews(params: ReviewListParams): Promise<PaginatedResult<Review>>;
  patchReview(id: ReviewId, patch: ReviewPatch): Promise<Review>;
  setStatus(id: ReviewId, status: ReviewStatus): Promise<Review>;
  replyToReview(id: ReviewId, reply: string): Promise<Review>;
  deleteReview(id: ReviewId): Promise<boolean>;
  describeSelection(objectType: string): Promise<SelectionDescriptor>;
  inspectReviews(filter?: FilterObject): Promise<SelectionStats>;
  getReviewsDashboard(): Promise<ReviewsDashboard>;
  createInvite(input: ReviewInviteInput): Promise<ReviewInvite>;
  listInvites(params: ReviewInviteListParams): Promise<PaginatedResult<ReviewInvite>>;
  patchInvite(id: ReviewInviteId, patch: ReviewInvitePatch): Promise<void>;
  findInvitesToFollowUp(days: number, maxFollowups: number, limit: number): Promise<ReviewInvite[]>;
  getInviteByToken(token: string): Promise<ReviewInviteView | any>;
  markInviteOpened(token: string): Promise<ReviewInviteView | any>;
  submitByToken(token: string, submission: ReviewSubmission): Promise<ReviewId | any>;
  getSettings(): Promise<ReviewSettings>;
  saveSettings(patch: ReviewSettingsPatch): Promise<ReviewSettings>;
}

// Native factory: cruller-transport -> Fujin -> cluster peer.
// Package exports select this entrypoint outside a browser build.
export function createReviewsServiceClient(
  config: CrullerTransportClientConfig,
): ReviewsServiceClient {
  return createCrullerTransportClient<ReviewsServiceClient>(metadata, config);
}

export function createReviewsServiceCrullerTransportClient(
  config: CrullerTransportClientConfig,
): ReviewsServiceClient {
  return createReviewsServiceClient(config);
}
