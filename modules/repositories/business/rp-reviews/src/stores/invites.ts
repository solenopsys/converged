import {
	AccessTags,
	generateULID,
	type SqlStore,
	visibleFrom,
} from "back-core";
import type {
	PaginatedResult,
	ReviewFunnel,
	ReviewId,
	ReviewInvite,
	ReviewInviteId,
	ReviewInviteInput,
	ReviewInviteListParams,
	ReviewInvitePatch,
	ReviewInviteStatus,
	ReviewInviteView,
} from "../types";

const TOKEN_BYTES = 24;
const ALPHABET = "abcdefghijkmnopqrstuvwxyz23456789";

/**
 * An unguessable link token.
 *
 * ULIDs are time-ordered, so one link would tell an attacker roughly where the
 * next one lives; this is drawn from the platform CSPRNG instead. The alphabet
 * drops the characters people mistype when they read a link out loud, because
 * these end up in emails and occasionally in phone calls.
 */
function mintToken(): string {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	let out = "";
	for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
	return out;
}

/**
 * Personal links and what became of them.
 *
 * Two ways in, and they are not the same door. The shop reaches invites through
 * the access tags like everything else; the customer reaches exactly one of
 * them by holding its token, with no session at all. A token is a capability:
 * knowing it *is* the authorisation, which is why the token methods below skip
 * the tag check deliberately rather than by omission — and why they return a
 * narrowed view that carries neither the contact nor the id.
 */
export class ReviewInvitesStoreService {
	readonly access: AccessTags;

	constructor(private store: SqlStore) {
		this.access = new AccessTags(store);
	}

	async create(
		input: ReviewInviteInput,
		ttlDays: number,
	): Promise<ReviewInvite> {
		const id = generateULID();
		const now = new Date();
		const days = input.ttlDays ?? ttlDays;
		const expiresAt = new Date(
			now.getTime() + days * 24 * 60 * 60 * 1000,
		).toISOString();
		const createdAt = now.toISOString();
		const row = {
			id,
			orderId: input.orderId,
			token: mintToken(),
			contact: input.contact,
			lang: input.lang ?? null,
			status: "queued",
			expiresAt,
			followupCount: 0,
			createdAt,
			updatedAt: createdAt,
		};
		await this.store.db
			.insertInto("review_invites" as never)
			.values(row as never)
			.execute();
		// Shop-wide by meaning: whoever works the funnel works all of it.
		await this.access.tagNew(id, { visibility: "authenticated" });
		return toInvite(row);
	}

	async list(
		params: ReviewInviteListParams,
	): Promise<PaginatedResult<ReviewInvite>> {
		const limit = params.limit ?? 50;
		const offset = params.offset ?? 0;

		const items = await this.applyFilters(this.visible(), params)
			.selectAll("obj")
			.orderBy("obj.createdAt", "desc")
			.limit(limit)
			.offset(offset)
			.execute();

		const count = await this.applyFilters(this.visible(), params)
			.select((eb: any) => eb.fn.countAll().as("count"))
			.executeTakeFirst();

		return {
			items: (items as any[]).map(toInvite),
			totalCount: Number(count?.count ?? 0),
		};
	}

	async patch(id: ReviewInviteId, patch: ReviewInvitePatch): Promise<void> {
		await this.access.requireWrite(id);
		const values: Record<string, unknown> = { updatedAt: nowIso() };
		for (const key of [
			"status",
			"sentAt",
			"lastFollowupAt",
			"followupCount",
			"error",
		] as const) {
			if (patch[key] !== undefined) values[key] = patch[key];
		}
		await this.update(id, values);
	}

	/**
	 * Links that were sent, went quiet for `days`, and have not been chased
	 * `maxFollowups` times yet.
	 *
	 * `openedAt is null` is the condition that makes this a chase and not a
	 * nag: somebody who opened the form and chose not to write has answered the
	 * question, and asking twice is how a review request becomes spam.
	 */
	async toFollowUp(
		days: number,
		maxFollowups: number,
		limit: number,
	): Promise<ReviewInvite[]> {
		const cutoff = new Date(
			Date.now() - days * 24 * 60 * 60 * 1000,
		).toISOString();
		const now = nowIso();
		const rows = await this.visible()
			.selectAll("obj")
			.where("obj.status", "=", "sent")
			.where("obj.openedAt", "is", null)
			.where("obj.expiresAt", ">", now)
			.where("obj.followupCount", "<", maxFollowups)
			.where((eb: any) =>
				eb.or([
					eb("obj.lastFollowupAt", "is", null),
					eb("obj.lastFollowupAt", "<", cutoff),
				]),
			)
			.where("obj.sentAt", "<", cutoff)
			.orderBy("obj.sentAt", "asc")
			.limit(limit)
			.execute();
		return (rows as any[]).map(toInvite);
	}

	/** The funnel, counted over the links the caller may see. */
	async funnel(): Promise<ReviewFunnel> {
		const rows = (await this.visible()
			.select(["obj.status as status", "obj.openedAt as openedAt"])
			.execute()) as Array<{ status: string; openedAt: string | null }>;

		const funnel: ReviewFunnel = {
			invited: rows.length,
			sent: 0,
			opened: 0,
			answered: 0,
			expired: 0,
		};
		for (const row of rows) {
			// The states are cumulative: an answered link was also sent and opened.
			if (row.status !== "queued" && row.status !== "failed") funnel.sent += 1;
			if (row.openedAt) funnel.opened += 1;
			if (row.status === "answered") funnel.answered += 1;
			if (row.status === "expired") funnel.expired += 1;
		}
		return funnel;
	}

	// --- the token door -----------------------------------------------------

	async byToken(token: string): Promise<ReviewInviteView | null> {
		const row = await this.rowByToken(token);
		return row ? toView(row) : null;
	}

	/**
	 * Records that the link was opened, which is the middle of the funnel and
	 * also what stops the chase.
	 */
	async markOpened(token: string): Promise<ReviewInviteView | null> {
		const row = await this.rowByToken(token);
		if (!row) return null;
		if (!row.openedAt) {
			const now = nowIso();
			await this.update(row.id, {
				openedAt: now,
				status: row.status === "sent" ? "opened" : row.status,
				updatedAt: now,
			});
			row.openedAt = now;
			if (row.status === "sent") row.status = "opened";
		}
		return toView(row);
	}

	/**
	 * Spends the link on a review.
	 *
	 * Good once: the update is conditional on the link still being unanswered,
	 * so two forms submitted from the same mail race for one row and the loser
	 * is told the link is spent instead of adding a second review.
	 */
	async consume(token: string, reviewId: ReviewId): Promise<boolean> {
		const row = await this.rowByToken(token);
		if (!row || !usable(row)) return false;
		const now = nowIso();
		const result = await this.store.db
			.updateTable("review_invites" as never)
			.set({
				status: "answered",
				answeredAt: now,
				reviewId,
				updatedAt: now,
			} as never)
			.where("id" as never, "=", row.id)
			.where("status" as never, "!=", "answered")
			.executeTakeFirst();
		return Number(result?.numUpdatedRows ?? 0) > 0;
	}

	private async rowByToken(token: string): Promise<any | null> {
		const trimmed = (token ?? "").trim();
		if (!trimmed) return null;
		const row = await this.store.db
			.selectFrom("review_invites" as never)
			.selectAll()
			.where("token" as never, "=", trimmed)
			.executeTakeFirst();
		return row ?? null;
	}

	private visible() {
		return visibleFrom(this.store.db, "review_invites");
	}

	private applyFilters(query: any, params: ReviewInviteListParams) {
		let next = query;
		if (params.orderId) next = next.where("obj.orderId", "=", params.orderId);
		if (params.orderIds?.length)
			next = next.where("obj.orderId", "in", params.orderIds);
		if (params.status) next = next.where("obj.status", "=", params.status);
		return next;
	}

	private async update(id: ReviewInviteId, values: Record<string, unknown>) {
		await this.store.db
			.updateTable("review_invites" as never)
			.set(values as never)
			.where("id" as never, "=", id)
			.execute();
	}
}

function usable(row: { status: string; expiresAt: string }): boolean {
	if (row.status === "answered" || row.status === "expired") return false;
	return row.expiresAt > nowIso();
}

function nowIso(): string {
	return new Date().toISOString();
}

function toInvite(row: any): ReviewInvite {
	const invite: ReviewInvite = {
		id: row.id,
		orderId: row.orderId,
		token: row.token,
		contact: row.contact,
		status: (row.status ?? "queued") as ReviewInviteStatus,
		expiresAt: row.expiresAt,
		followupCount: Number(row.followupCount ?? 0),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt ?? row.createdAt,
	};
	for (const key of [
		"lang",
		"sentAt",
		"openedAt",
		"answeredAt",
		"lastFollowupAt",
		"reviewId",
		"error",
	] as const) {
		if (row[key] !== null && row[key] !== undefined)
			(invite as any)[key] = row[key];
	}
	return invite;
}

function toView(row: any): ReviewInviteView {
	const view: ReviewInviteView = {
		orderId: row.orderId,
		status: (row.status ?? "queued") as ReviewInviteStatus,
		expiresAt: row.expiresAt,
		usable: usable(row),
	};
	if (row.lang) view.lang = row.lang;
	return view;
}
