export type ReviewId = string;
export type ReviewInviteId = string;
export type OrderId = string;
export type RequestId = string;
export type ISODateString = string;

/**
 * A review is written to be read — but not the instant it arrives.
 *
 * `pending` is the state a review is born in when it comes from outside: it is
 * visible to the shop and to nobody else until somebody publishes it. That is
 * the whole reason the status exists, and the reason publishing is the one
 * place that widens visibility.
 */
export type ReviewStatus = "pending" | "published" | "rejected";

/** Where the text came from, which is not the same question as who wrote it. */
export type ReviewSource = "site" | "invite" | "staff" | "external";

/**
 * The life of one personal link, which is also the funnel the shop reads:
 * queued → sent → opened → answered, with `expired` and `failed` as the two
 * ways it ends without a review.
 */
export type ReviewInviteStatus =
	| "queued"
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

/**
 * One personal link: an invitation to review one order, good once.
 *
 * The token lives here rather than on the review because the two have
 * different lifetimes. A link is sent, chased, opened and may expire without
 * ever producing a review; a review, once written, outlives the link that
 * asked for it. Keeping them apart is what makes the funnel countable — the
 * shop can see how many were asked against how many answered, which a token
 * column on a row that only exists after the answer cannot show.
 */
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

/**
 * What the public form is allowed to learn from a token.
 *
 * Deliberately not the invite: the contact and the id are the shop's business,
 * and a form that never receives them cannot leak them.
 */
export type ReviewInviteView = {
	orderId: OrderId;
	status: ReviewInviteStatus;
	expiresAt: ISODateString;
	/** Already answered or expired — the form shows a message instead of a field. */
	usable: boolean;
	lang?: string;
};

/** An answer arriving from the public form, carrying its own authorisation. */
export type ReviewSubmission = {
	author?: string;
	text: string;
	rating: number;
	contact?: string;
	/** Set when the author then went on to an external platform. */
	externalPlatform?: string;
};

/**
 * One place the shop asks people to say it publicly.
 *
 * `url` is where the author is sent; `shareText` is what is put in their
 * clipboard so that leaving the review there costs one click.
 */
export type ReviewPlatform = {
	id: string;
	label: string;
	url: string;
	shareText?: string;
	enabled?: boolean;
};

/**
 * How this shop runs its review funnel.
 *
 * `positiveThreshold` decides the *emphasis* of the public form and nothing
 * else: at or above it the author is offered the platforms first, below it
 * they are offered a word with the shop first. What it must never do is decide
 * whether the platform links exist at all — Google and others forbid showing
 * the path to a public review only to happy customers, so the links stay
 * visible to everybody and only the order of the offer changes. The safe
 * behaviour is the default because the unsafe one is a complaint waiting to
 * happen, not a setting.
 */
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
	subjectTemplate: string;
	bodyTemplate: string;
	followupSubjectTemplate: string;
	followupBodyTemplate: string;
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

/** Sent, opened, answered — the three numbers contour 2 is judged by. */
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

export interface ReviewsService {
	createReview(input: ReviewInput): Promise<ReviewId>;
	getReview(id: ReviewId): Promise<Review | null>;
	listReviews(params: ReviewListParams): Promise<PaginatedResult<Review>>;
	patchReview(id: ReviewId, patch: ReviewPatch): Promise<Review>;
	/** Publishing is what makes a review readable without a token. */
	setStatus(id: ReviewId, status: ReviewStatus): Promise<Review>;
	replyToReview(id: ReviewId, reply: string): Promise<Review>;
	deleteReview(id: ReviewId): Promise<boolean>;
	describeSelection(objectType: string): Promise<SelectionDescriptor>;
	inspectReviews(filter?: FilterObject): Promise<SelectionStats>;
	getReviewsDashboard(): Promise<ReviewsDashboard>;

	createInvite(input: ReviewInviteInput): Promise<ReviewInvite>;
	listInvites(
		params: ReviewInviteListParams,
	): Promise<PaginatedResult<ReviewInvite>>;
	patchInvite(id: ReviewInviteId, patch: ReviewInvitePatch): Promise<void>;
	/** Links sent, silent for `days`, and not yet chased `maxFollowups` times. */
	findInvitesToFollowUp(
		days: number,
		maxFollowups: number,
		limit: number,
	): Promise<ReviewInvite[]>;

	/** The three token methods below are authorised by the token, not by a session. */
	getInviteByToken(token: string): Promise<ReviewInviteView | null>;
	markInviteOpened(token: string): Promise<ReviewInviteView | null>;
	submitByToken(
		token: string,
		submission: ReviewSubmission,
	): Promise<ReviewId | null>;

	getSettings(): Promise<ReviewSettings>;
	saveSettings(patch: ReviewSettingsPatch): Promise<ReviewSettings>;
}
