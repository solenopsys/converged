import { generateULID, SqlStore, sql } from "back-core";
import type {
	CreateTicketInput,
	PaginatedResult,
	Ticket,
	TicketId,
	TicketListParams,
	TicketStatus,
} from "../../types";

export class SupportStoreService {
	constructor(private store: SqlStore) {}

	async createTicket(input: CreateTicketInput, authorId: string): Promise<Ticket> {
		const now = new Date().toISOString();

		// The ticket number is what people say out loud ("#142"), so it counts up
		// rather than being a ULID. Taking max+1 is safe because one repository
		// owns this table and writes to it one call at a time.
		const highest = await this.store.db
			.selectFrom("tickets")
			.select(({ fn }) => fn.max<number>("number").as("highest"))
			.executeTakeFirst();

		const ticket: Ticket = {
			id: generateULID(),
			number: Number(highest?.highest ?? 0) + 1,
			type: input.type,
			title: input.title,
			status: "open",
			authorId,
			threadId: input.threadId,
			votes: 0,
			createdAt: now,
			updatedAt: now,
		};

		await this.store.db.insertInto("tickets").values(ticket).execute();
		return ticket;
	}

	async getTicket(id: TicketId): Promise<Ticket | undefined> {
		const row = await this.store.db
			.selectFrom("tickets")
			.selectAll()
			.where("id", "=", id)
			.executeTakeFirst();
		return row as Ticket | undefined;
	}

	/**
	 * `visibleTo` is the caller when they may only see their own, and undefined
	 * when they may see everything — the team, or anyone browsing features.
	 * It is applied here rather than left to the caller so that no list method
	 * can forget it.
	 */
	async listTickets(
		params: TicketListParams,
		visibleTo?: string,
	): Promise<PaginatedResult<Ticket>> {
		const narrow = (query: any) => {
			let next = query;
			if (params.type) next = next.where("type", "=", params.type);
			if (params.status) next = next.where("status", "=", params.status);
			if (visibleTo) next = next.where("authorId", "=", visibleTo);
			if (params.query?.trim()) {
				next = next.where(
					sql`lower(title)`,
					"like",
					`%${params.query.trim().toLowerCase()}%`,
				);
			}
			return next;
		};

		const rows = await narrow(this.store.db.selectFrom("tickets").selectAll())
			.orderBy(params.sort === "votes" ? "votes" : "createdAt", "desc")
			.limit(params.limit ?? 50)
			.offset(params.offset ?? 0)
			.execute();

		const counted = await narrow(
			this.store.db.selectFrom("tickets").select(({ fn }) => fn.countAll().as("count")),
		).executeTakeFirst();

		return { items: rows as Ticket[], totalCount: Number(counted?.count ?? 0) };
	}

	/**
	 * A like and the count move together, or neither moves.
	 *
	 * `votes` is a copy of how many rows sit in `ticket_votes`, and the two
	 * disagreeing is worse than either being wrong: the rating would order
	 * features by a number no longer connected to anybody's opinion.
	 */
	async vote(id: TicketId, userId: string): Promise<number> {
		return this.store.db.transaction().execute(async (trx) => {
			const inserted = await trx
				.insertInto("ticket_votes")
				.values({ ticketId: id, userId, at: new Date().toISOString() })
				.onConflict((oc) => oc.columns(["ticketId", "userId"]).doNothing())
				.executeTakeFirst();

			if (Number(inserted?.numInsertedOrUpdatedRows ?? 0) > 0) {
				await trx
					.updateTable("tickets")
					.set((eb: any) => ({ votes: eb("votes", "+", 1) }))
					.where("id", "=", id)
					.execute();
			}

			const row = await trx
				.selectFrom("tickets")
				.select("votes")
				.where("id", "=", id)
				.executeTakeFirst();
			return Number(row?.votes ?? 0);
		});
	}

	async unvote(id: TicketId, userId: string): Promise<number> {
		return this.store.db.transaction().execute(async (trx) => {
			const deleted = await trx
				.deleteFrom("ticket_votes")
				.where("ticketId", "=", id)
				.where("userId", "=", userId)
				.executeTakeFirst();

			if (Number(deleted?.numDeletedRows ?? 0) > 0) {
				await trx
					.updateTable("tickets")
					.set((eb: any) => ({ votes: eb("votes", "-", 1) }))
					.where("id", "=", id)
					.execute();
			}

			const row = await trx
				.selectFrom("tickets")
				.select("votes")
				.where("id", "=", id)
				.executeTakeFirst();
			return Number(row?.votes ?? 0);
		});
	}

	async setStatus(id: TicketId, status: TicketStatus): Promise<Ticket | undefined> {
		await this.store.db
			.updateTable("tickets")
			.set({ status, updatedAt: new Date().toISOString() })
			.where("id", "=", id)
			.execute();
		return this.getTicket(id);
	}
}
