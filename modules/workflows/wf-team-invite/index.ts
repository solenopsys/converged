// wf-team-invite — the whole of "somebody pasted a list of people into the
// chat and now they work here". Four services have to move together for one
// row of that list: identity (a user), access (a role), staff (a card) and
// auth + mail (a way in). Microservices do not call each other, so this is the
// only place the cascade can live.
//
// It is also the privilege boundary. `rp-access` refuses a user JWT outright
// (`@Access("internal")`), so no surface can hand out a role; centimanus runs
// this script with SERVICE_TOKEN, and who may run it is an ordinary grant —
// `wf/workflows/wf-team-invite.js(x)` — that lives in one preset file. That is
// why there is no "administrator" concept anywhere in this product.
//
// Shape follows wf-sales-import: the model gets first pass at the text, a
// deterministic parser catches what it misses, and every person is their own
// rt.attempt so one bad address cannot sink the batch. Unlike that one the
// parser lives here: pulling names off "Ivan <i@shop.test>" is a regex, and
// putting a method on rp-identity for it would be contract for nothing.

import "dag-core/env";

import { createAccessServiceRtClient } from "g-access/rt";
import { createAuthServiceRtClient } from "g-auth/rt";
import { createFilesServiceRtClient } from "g-files/rt";
import { createIdentityServiceRtClient } from "g-identity/rt";
import { createNotifyServiceRtClient } from "g-notify/rt";
import { createSesServiceRtClient } from "g-ses/rt";
import { createSmtpServiceRtClient } from "g-smtp/rt";
import { createStaffServiceRtClient } from "g-staff/rt";

const access = createAccessServiceRtClient();
const auth = createAuthServiceRtClient();
const files = createFilesServiceRtClient();
const identity = createIdentityServiceRtClient();
const notify = createNotifyServiceRtClient();
const ses = createSesServiceRtClient();
const smtp = createSmtpServiceRtClient();
const staff = createStaffServiceRtClient();

/** Every signed-in person carries this, and their role on top of it. Merging
 *  is how presets inherit — rp-access unions every linked tree. */
const BASE_PRESET = "user";

/**
 * Roles this workflow is allowed to hand out.
 *
 * The list is the escalation guard, and it is deliberately not "any preset that
 * exists": `root` and `owner` are absent, so the right to invite operators can
 * never be turned into the right to make oneself the owner. The script cannot
 * check the caller itself — centimanus keeps the acting user in the envelope of
 * downstream calls, not in the VM — so the guard has to be a fixed list rather
 * than a comparison.
 */
const GRANTABLE_PRESETS = ["manager", "operator", "viewer"];

const DEFAULTS = {
	preset: "operator",
	/** how much of one file to read; same cap the sales import uses */
	maxCharsPerFile: 120000,
	maxTokens: 4096,
	subject: "You have been added to the workshop console",
	dryRun: false,
};

type Input = Partial<typeof DEFAULTS> & {
	rawText?: string;
	fileIds?: string[];
	/** group tags granted alongside the role, e.g. ["team-ops"] */
	tags?: string[];
	/** who is doing the inviting, for the journal; see §2.2 of team-contour.md */
	invitedBy?: string;
	/** Envelope sender; left out, the lambda uses the deployment's MAIL_FROM. */
	from?: string;
	/**
	 * Which relay the deployment runs. Not a credential — those live in the
	 * lambda's own environment — only the shape of the deployment, and the
	 * one thing a global script cannot work out for itself.
	 */
	transport?: "ses" | "smtp";
	consoleUrl?: string;
	/** provider+model enable the LLM pass; without them only the regex runs */
	provider?: string;
	model?: string;
};

type Person = { email: string; name: string };

type Outcome = {
	email: string;
	name: string;
	status: "created" | "updated" | "skipped" | "failed";
	staffId?: string;
	userId?: string;
	invited?: boolean;
	mailed?: boolean;
	reason?: string;
};

const EXTRACT_PROMPT = [
	"Extract the list of people from the input.",
	"Return only valid JSON with this shape:",
	'{"people":[{"email":"","name":""}]}',
	"Use the name written next to the address. Do not invent addresses and do not invent names.",
	"If a row has no name, leave it empty.",
].join("\n");

// Deliberately loose: this reads what a human pasted, not what a form
// validated. Anything shaped like an address is one; the gate and the mail
// transport are what decide whether it is real.
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;

function normalizeEmail(value: string): string {
	return value.trim().toLowerCase();
}

/** The model is asked for bare JSON and often wraps it in a fence. */
function parsePeopleJson(body: string): Person[] {
	const cleaned = body
		.replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/, "$1")
		.trim();
	const parsed = JSON.parse(cleaned) as any;
	const rows = Array.isArray(parsed) ? parsed : (parsed?.people ?? []);
	if (!Array.isArray(rows)) return [];
	return rows
		.map((row: any) => ({
			email: normalizeEmail(String(row?.email ?? "")),
			name: String(row?.name ?? "").trim(),
		}))
		.filter((row: Person) => row.email.includes("@"));
}

/**
 * The fallback, and the thing that makes the LLM optional rather than required.
 *
 * One line, one person: the address is whatever matches, and the name is the
 * rest of the line with the punctuation people put around addresses stripped
 * off. That covers "Ivan Petrov <i@shop.test>", "i@shop.test, Ivan", a column
 * of bare addresses, and a table pasted out of a spreadsheet.
 */
function parsePeopleText(text: string): Person[] {
	const found: Person[] = [];
	for (const line of text.split(/\r?\n/)) {
		EMAIL_RE.lastIndex = 0;
		const matches = line.match(EMAIL_RE);
		if (!matches) continue;
		for (const match of matches) {
			const email = normalizeEmail(match);
			const name = line
				.replace(match, " ")
				.replace(/[<>(),;:"'|\t]+/g, " ")
				.replace(/\s{2,}/g, " ")
				.trim();
			found.push({ email, name });
		}
	}
	return found;
}

const hex = (n: number, width: number): string =>
	(n >>> 0).toString(16).padStart(8, "0").slice(0, width);

/**
 * A user id, in canonical v4 shape.
 *
 * `crypto.randomUUID` does not exist in QuickJS, and the same thing is done in
 * wf-sales-review-outreach for the same reason. Lowercase hex with hyphens is
 * what the object-access rules require of an id (no `:`, no `;` — those are the
 * KV key separators). Only ever called inside an attempt, so a replay reuses
 * the id instead of minting a second account.
 */
function newUserId(): string {
	const rand = (width: number) =>
		hex(Math.floor(Math.random() * 0x100000000), width);
	return `${rand(8)}-${rand(4)}-4${rand(3)}-a${rand(3)}-${rand(8)}${rand(4)}`;
}

/** A name we can put on a card even when the list had none. */
function nameFor(person: Person): string {
	if (person.name) return person.name;
	const local = person.email.split("@")[0] ?? person.email;
	return local.replace(/[._-]+/g, " ").trim() || person.email;
}

function dedupe(people: Person[]): Person[] {
	const seen = new Set<string>();
	const unique: Person[] = [];
	for (const person of people) {
		if (seen.has(person.email)) continue;
		seen.add(person.email);
		unique.push({ email: person.email, name: nameFor(person) });
	}
	return unique;
}

function letterBody(name: string, link: string, consoleUrl: string): string {
	return [
		`<p>Hello${name ? `, ${name}` : ""}!</p>`,
		"<p>You have been added to the workshop console. This link signs you in:</p>",
		`<p><a href="${link}">${link}</a></p>`,
		consoleUrl
			? `<p>The console lives at <a href="${consoleUrl}">${consoleUrl}</a>.</p>`
			: "",
		"<p>If you were not expecting this, ignore the message.</p>",
	]
		.filter(Boolean)
		.join("\n");
}

rt.workflow = (input: Input) => {
	const o = { ...DEFAULTS, ...(input ?? {}) };
	const fileIds = input?.fileIds ?? [];
	const rawText = (input?.rawText ?? "").trim();
	if (fileIds.length === 0 && !rawText)
		throw new Error("team-invite requires params.rawText or params.fileIds");

	const preset = String(o.preset || DEFAULTS.preset);
	if (!GRANTABLE_PRESETS.includes(preset))
		throw new Error(
			`team-invite refuses to grant "${preset}"; allowed: ${GRANTABLE_PRESETS.join(", ")}`,
		);

	const tags = (input?.tags ?? [])
		.map((tag) => String(tag).trim())
		.filter(Boolean);
	const invitedBy = (input?.invitedBy ?? "").trim() || "owner";
	const consoleUrl = (input?.consoleUrl ?? "").trim();
	const errors: { id?: string; stage: string; message: string }[] = [];

	// ---- 1. text sources ---------------------------------------------------
	const texts: string[] = [];
	const sources: { fileId: string; name: string; chars: number }[] = [];
	for (const fileId of fileIds) {
		const read = rt.attempt(`read-file:${fileId}`, () => {
			const staged = files.materialize(fileId);
			const extracted = files.extractText({
				ref: staged.ref,
				name: staged.metadata.name,
				maxChars: o.maxCharsPerFile,
			});
			return { name: staged.metadata.name, ...extracted };
		});
		if (!read.ok) {
			errors.push({ id: fileId, stage: "load", message: read.error });
			continue;
		}
		sources.push({ fileId, name: read.value.name, chars: read.value.chars });
		if (read.value.text.trim()) texts.push(read.value.text);
	}
	if (rawText) texts.push(rawText);

	const sourceText = texts.join("\n\n").trim();

	// ---- 2. people: LLM first, regex as the fallback ------------------------
	let people: Person[] = [];
	let format = "none";

	if (sourceText && input.provider && input.model) {
		const answered = rt.attempt("llm-extract", () =>
			rt.llm({
				provider: input.provider as string,
				model: input.model as string,
				maxTokens: o.maxTokens,
				messages: [
					{ role: "system", content: EXTRACT_PROMPT },
					{ role: "user", content: sourceText },
				],
			}),
		);
		if (answered.ok) {
			const parsed = rt.attempt("llm-parse", () =>
				parsePeopleJson(answered.value.text),
			);
			if (parsed.ok && parsed.value.length > 0) {
				people = parsed.value;
				format = "llm";
			} else if (!parsed.ok) {
				errors.push({ stage: "llm", message: parsed.error });
			}
		} else {
			errors.push({ stage: "llm", message: answered.error });
		}
	}

	if (people.length === 0 && sourceText) {
		people = rt.node("parse-people", () => parsePeopleText(sourceText));
		format = people.length > 0 ? "text" : "none";
	}

	people = dedupe(people);

	const result = {
		status: o.dryRun ? "dry-run" : people.length > 0 ? "invited" : "empty",
		format,
		parsed: people.length,
		created: 0,
		updated: 0,
		skipped: 0,
		failed: 0,
		mailed: 0,
		preset,
		tags,
		sources,
		errors,
		items: [] as Outcome[],
		/** what the surface turns into an open table of exactly these people */
		staffIds: [] as string[],
	};

	if (people.length === 0 || o.dryRun) {
		result.items = people.map((person) => ({
			email: person.email,
			name: person.name,
			status: "skipped" as const,
			reason: o.dryRun ? "dry-run" : "nothing parsed",
		}));
		rt.set("team-invite:last-result", result);
		rt.log(`team-invite: ${result.status} parsed=${people.length} (${format})`);
		return result;
	}

	// ---- 3. one attempt per person ------------------------------------------
	for (const person of people) {
		const outcome: Outcome = {
			email: person.email,
			name: person.name,
			status: "failed",
		};

		const done = rt.attempt(`invite:${person.email}`, () => {
			// An address already known is not an error and not a second account:
			// re-running the same list must be harmless, which is what makes this
			// safe to call from a chat where nobody tracks what was run before.
			const existing = identity.getUserByEmail(person.email);
			const user =
				existing ??
				identity.createUser({
					id: newUserId(),
					email: person.email,
					name: person.name,
					emailVerified: false,
					preset,
				});
			outcome.userId = user.id;
			outcome.status = existing ? "updated" : "created";

			// The role: base plus exactly one domain preset. Linking is idempotent
			// in rp-access, so a re-run does not stack anything.
			access.linkPresetToUser(user.id, BASE_PRESET);
			access.linkPresetToUser(user.id, preset);
			for (const tag of tags) access.addTagToUser(user.id, tag, "rwx");

			// The card exists before the first sign-in, so the roster is complete
			// the moment the import finishes rather than filling in as people
			// arrive.
			const card = staff.getStaffByEmail(person.email);
			if (card) {
				staff.updateStaff(card.id, {
					userId: user.id,
					role: preset,
					active: true,
				});
				outcome.staffId = card.id;
			} else {
				outcome.staffId = staff.createStaff({
					userId: user.id,
					name: person.name,
					email: person.email,
					role: preset,
					active: true,
				});
			}

			// The invitation carries no token of its own: it says the address is
			// allowed in and with what role. The way in stays the one magic link.
			identity.createInvite({
				email: person.email,
				name: person.name,
				preset,
				tags,
				invitedBy,
			});
			outcome.invited = true;

			return outcome;
		});

		if (!done.ok) {
			outcome.status = "failed";
			outcome.reason = done.error;
			errors.push({ id: person.email, stage: "invite", message: done.error });
			result.failed += 1;
			result.items.push(outcome);
			continue;
		}

		// ---- the letter: a branch, never an exception -----------------------
		// A refused SMTP relay must not undo an account that already exists. The
		// address is in, the role is granted; what failed is one delivery, and
		// that is what "resend" is for.
		const mailed = rt.attempt(`mail:${person.email}`, () => {
			const link = auth.getMagicLink(person.email, consoleUrl || undefined);
			const url = consoleUrl
				? `${consoleUrl.replace(/\/+$/, "")}/auth/verify?token=${encodeURIComponent(link.token)}`
				: link.token;
			const payload = {
				from: input.from,
				to: person.email,
				subject: o.subject,
				body: letterBody(person.name, url, consoleUrl),
				type: "html" as const,
			};
			const sent =
				input.transport === "smtp"
					? smtp.sendEmail(payload)
					: ses.sendEmail(payload);
			if (!sent.success) throw new Error(sent.error ?? "delivery refused");
			return sent;
		});

		if (mailed.ok) {
			outcome.mailed = true;
			result.mailed += 1;
			const invite = identity.getInviteByEmail(person.email);
			if (invite) identity.markInviteSent(invite.id);
		} else {
			outcome.mailed = false;
			outcome.reason = mailed.error;
			errors.push({ id: person.email, stage: "mail", message: mailed.error });
		}

		// The delivery journal is the same one every other letter writes to,
		// so "was this person actually told" is one question with one answer.
		rt.attempt(`journal:${person.email}`, () =>
			notify.recordSend({
				templateId: "team-invite",
				channel: "email",
				recipient: person.email,
				params: { preset, invitedBy },
				status: outcome.mailed ? "sent" : "failed",
			}),
		);

		if (outcome.status === "created") result.created += 1;
		else if (outcome.status === "updated") result.updated += 1;
		if (outcome.staffId) result.staffIds.push(outcome.staffId);
		result.items.push(outcome);
	}

	rt.set("team-invite:last-result", result);
	rt.log(
		`team-invite: ${format} parsed=${result.parsed} created=${result.created} ` +
			`updated=${result.updated} failed=${result.failed} mailed=${result.mailed}`,
	);
	return result;
};
