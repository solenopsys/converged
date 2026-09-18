export type TicketId = string;
export type ThreadId = string;
export type UserId = string;
export type ISODateString = string;

/**
 * Two types, one mechanism.
 *
 * `bug` — something is broken; the author and the team see it.
 * `feature` — something is missing; everybody sees it and votes with a like.
 */
export type TicketType = "bug" | "feature";

export type TicketStatus = "open" | "planned" | "in_progress" | "done" | "rejected";

export type Ticket = {
	id: TicketId;
	/** Human-readable: #142. Server-assigned, never reused. */
	number: number;
	type: TicketType;
	title: string;
	status: TicketStatus;
	authorId: UserId;
	/** Description, replies and files all live in `rp-threads`. */
	threadId: ThreadId;
	/** Denormalised so the rating can be ordered by it. */
	votes: number;
	createdAt: ISODateString;
	updatedAt: ISODateString;
};

/**
 * The thread is made before the ticket and handed in here: a repository does
 * not call another repository, so `rp-support` cannot open one for itself.
 */
export type CreateTicketInput = {
	type: TicketType;
	title: string;
	threadId: ThreadId;
};

export type TicketSort = "newest" | "votes";

export type TicketListParams = {
	offset: number;
	limit: number;
	type?: TicketType;
	status?: TicketStatus;
	/** Only the caller's own. */
	mine?: boolean;
	/** Case-insensitive match on the title — what deduplication searches with. */
	query?: string;
	sort?: TicketSort;
};

export type PaginatedResult<T> = {
	items: T[];
	totalCount?: number;
};

export interface SupportService {
	createTicket(input: CreateTicketInput): Promise<Ticket>;
	getTicket(id: TicketId): Promise<Ticket | undefined>;
	listTickets(params: TicketListParams): Promise<PaginatedResult<Ticket>>;

	/** One person, one like. Voting twice changes nothing and is not an error. */
	vote(id: TicketId): Promise<number>;
	unvote(id: TicketId): Promise<number>;

	/** The 4IR team only. */
	setStatus(id: TicketId, status: TicketStatus): Promise<Ticket>;
}
