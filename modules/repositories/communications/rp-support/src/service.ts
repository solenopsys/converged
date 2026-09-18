import { Access, getCurrentAccessTags, getCurrentWorkspaceContext } from "nrpc";
import type {
	CreateTicketInput,
	PaginatedResult,
	SupportService,
	Ticket,
	TicketId,
	TicketListParams,
	TicketStatus,
} from "./types";
import { StoresController } from "./stores";

const REPOSITORY_ID = "rp-support";

/**
 * The group tag that marks the 4IR team.
 *
 * Reading it works today; *issuing* it is the open question (С3 in
 * `club-mvp-admin.md`). Until that is answered nobody carries the tag, which
 * fails the safe way — the queue is empty and no status can be set — rather
 * than the other way round.
 */
const TEAM_TAG = "4ir-team";

/** Who is calling, from the verified token and from nothing else. */
function requireActor(): string {
	const actor = getCurrentWorkspaceContext()?.user?.trim();
	if (!actor) {
		const error: any = new Error("Authenticated caller is required");
		error.statusCode = 401;
		throw error;
	}
	return actor;
}

function isTeam(): boolean {
	return getCurrentAccessTags().includes(TEAM_TAG);
}

export class SupportServiceImpl implements SupportService {
	private stores!: StoresController;
	private initPromise: Promise<void>;

	constructor() {
		this.initPromise = this.init();
	}

	async init() {
		if (this.initPromise) {
			return this.initPromise;
		}

		this.initPromise = (async () => {
			this.stores = new StoresController(REPOSITORY_ID);
			await this.stores.init();
		})();

		return this.initPromise;
	}

	@Access("user")
	async createTicket(input: CreateTicketInput): Promise<Ticket> {
		await this.ensureReady();
		if (!input?.title?.trim() || !input?.type || !input?.threadId) {
			const error: any = new Error("type, title and threadId are required");
			error.statusCode = 400;
			throw error;
		}
		return this.stores.support.createTicket(
			{ ...input, title: input.title.trim() },
			requireActor(),
		);
	}

	/**
	 * A feature is everyone's business — that is what makes the rating mean
	 * anything. A bug is between its author and the team.
	 */
	@Access("user")
	async getTicket(id: TicketId): Promise<Ticket | undefined> {
		await this.ensureReady();
		const ticket = await this.stores.support.getTicket(id);
		if (!ticket) return undefined;
		if (ticket.type === "feature" || isTeam()) return ticket;
		return ticket.authorId === requireActor() ? ticket : undefined;
	}

	@Access("user")
	async listTickets(params: TicketListParams): Promise<PaginatedResult<Ticket>> {
		await this.ensureReady();
		const actor = requireActor();

		// Asking for your own is always allowed. Otherwise bugs are narrowed to
		// the caller unless they are the team, and features are never narrowed.
		// A listing with no type asked for could mix the two, so it is narrowed
		// as the stricter of the two — bugs.
		const unrestricted = isTeam() || (params.type === "feature" && !params.mine);
		const visibleTo = params.mine || !unrestricted ? actor : undefined;

		return this.stores.support.listTickets(params, visibleTo);
	}

	@Access("user")
	async vote(id: TicketId): Promise<number> {
		await this.ensureReady();
		await this.requireVotable(id);
		return this.stores.support.vote(id, requireActor());
	}

	@Access("user")
	async unvote(id: TicketId): Promise<number> {
		await this.ensureReady();
		await this.requireVotable(id);
		return this.stores.support.unvote(id, requireActor());
	}

	// Deciding what gets built is the team's call — "we are taking this" is the
	// `planned` status and nothing else.
	@Access("user")
	async setStatus(id: TicketId, status: TicketStatus): Promise<Ticket> {
		await this.ensureReady();
		if (!isTeam()) {
			const error: any = new Error("Only the 4IR team may set a ticket status");
			error.statusCode = 403;
			throw error;
		}
		const updated = await this.stores.support.setStatus(id, status);
		if (!updated) {
			const error: any = new Error(`No ticket ${id}`);
			error.statusCode = 404;
			throw error;
		}
		return updated;
	}

	/** Only a feature can be liked, and only one that the caller can see. */
	private async requireVotable(id: TicketId): Promise<void> {
		const ticket = await this.stores.support.getTicket(id);
		if (!ticket || ticket.type !== "feature") {
			const error: any = new Error(`No feature ticket ${id}`);
			error.statusCode = 404;
			throw error;
		}
	}

	private async ensureReady(): Promise<void> {
		await this.initPromise;
	}
}

export default SupportServiceImpl;
