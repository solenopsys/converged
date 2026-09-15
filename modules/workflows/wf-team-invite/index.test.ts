// wf-team-invite on the real VM core (librt-mock.so) with mocked identity /
// access / staff / auth / mail. Build the library first:
//   cd ../../../core/native/apps/centimanus && zig build mock

import { beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { buildWorkflow } from "../../../core/dag/core/build";
import { runWorkflow } from "../../../core/native/apps/centimanus/test/bun/centimanus-mock";
import { createTeamUniverse } from "./mock-services";

let source: string;
beforeAll(async () => {
	source = await buildWorkflow(join(import.meta.dir, "index.ts"));
});

/** What an owner actually pastes: three shapes in one block. */
const PASTED = [
	"Ivan Petrov <ivan@shop.test>",
	"maria@shop.test, Maria Ivanova",
	"petr@shop.test",
].join("\n");

// No credentials: lm-smtp reads its own environment. `transport` only says
// which relay this deployment runs — the one thing the flow cannot work out.
const MAIL = {
	from: "shop@example.test",
	transport: "smtp" as const,
	consoleUrl: "https://console.example.test",
};

const llm = (text: string) => (request: any) => ({
	provider: request.provider,
	model: request.model,
	text,
	toolCalls: [],
	finishReason: "stop",
	usage: { input: 0, output: 0 },
});

describe("wf-team-invite", () => {
	test("turns a pasted list into users, roles, cards and invitations", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(source, { rawText: PASTED }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		const r = outcome.result;
		expect(r.status).toBe("invited");
		expect(r.format).toBe("text");
		expect(r.parsed).toBe(3);
		expect(r.created).toBe(3);
		expect(r.failed).toBe(0);
		// The list of ids is the point: the surface turns it into an open table
		// of exactly these people.
		expect(r.staffIds).toHaveLength(3);

		expect([...u.users.keys()].sort()).toEqual([
			"ivan@shop.test",
			"maria@shop.test",
			"petr@shop.test",
		]);
		expect(
			[...u.invites.values()].map((invite: any) => invite.email).sort(),
		).toEqual(["ivan@shop.test", "maria@shop.test", "petr@shop.test"]);
	});

	test("reads the name whichever side of the address it was written on", () => {
		const u = createTeamUniverse();
		const outcome = runWorkflow(source, { rawText: PASTED }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		const byEmail = new Map(
			[...u.staff.values()].map((card: any) => [card.email, card.name]),
		);
		expect(byEmail.get("ivan@shop.test")).toBe("Ivan Petrov");
		expect(byEmail.get("maria@shop.test")).toBe("Maria Ivanova");
		// Nothing to read: the local part is a better card title than a blank.
		expect(byEmail.get("petr@shop.test")).toBe("petr");
	});

	test("gives everyone the base preset plus one role, and the group tags", () => {
		const u = createTeamUniverse();
		const outcome = runWorkflow(
			source,
			{ rawText: "ivan@shop.test", preset: "manager", tags: ["team-ops"] },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		const userId = u.users.get("ivan@shop.test")!.id;
		expect(u.presets.get(userId)).toEqual(["user", "manager"]);
		expect(u.tags.get(userId)).toEqual(["team-ops"]);
		expect([...u.staff.values()][0].role).toBe("manager");
	});

	test("refuses to hand out a role it is not allowed to hand out", () => {
		const u = createTeamUniverse();

		for (const preset of ["owner", "root"]) {
			const outcome = runWorkflow(
				source,
				{ rawText: "ivan@shop.test", preset },
				u.handler,
			);
			expect(outcome.ok).toBe(false);
			if (!outcome.ok) expect(outcome.error).toContain("refuses to grant");
		}
		expect(u.users.size).toBe(0);
	});

	test("re-running the same list adds nobody twice", () => {
		const u = createTeamUniverse();

		const first = runWorkflow(source, { rawText: PASTED }, u.handler);
		if (!first.ok) throw new Error(first.error);
		const second = runWorkflow(source, { rawText: PASTED }, u.handler);
		if (!second.ok) throw new Error(second.error);

		expect(second.result.created).toBe(0);
		expect(second.result.updated).toBe(3);
		expect(u.users.size).toBe(3);
		expect(u.staff.size).toBe(3);
		expect(u.invites.size).toBe(3);
	});

	test("adopts a card that was already filed for the address", () => {
		const u = createTeamUniverse();
		const staffId = u.addStaff("ivan@shop.test", "Ivan from the wall chart");

		const outcome = runWorkflow(
			source,
			{ rawText: "ivan@shop.test" },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(u.staff.size).toBe(1);
		expect(outcome.result.staffIds).toEqual([staffId]);
		expect(u.staff.get(staffId).userId).toBe(u.users.get("ivan@shop.test")!.id);
	});

	test("sends one letter per person and writes the delivery journal", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(
			source,
			{ rawText: PASTED, ...MAIL },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.mailed).toBe(3);
		expect(u.mails.map((mail) => mail.to).sort()).toEqual([
			"ivan@shop.test",
			"maria@shop.test",
			"petr@shop.test",
		]);
		expect(u.mails[0].body).toContain(
			"https://console.example.test/auth/verify?token=",
		);
		expect(u.journal).toHaveLength(3);
		expect(
			[...u.invites.values()].every((invite: any) => invite.status === "sent"),
		).toBe(true);
	});

	test("a refused relay is a branch, not a lost account", () => {
		const u = createTeamUniverse();
		u.failOn("smtp", "sendEmail", "relay refused");

		const outcome = runWorkflow(
			source,
			{ rawText: PASTED, ...MAIL },
			u.handler,
		);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		// Everyone is in and holds their role; what failed is three deliveries.
		expect(outcome.result.created).toBe(3);
		expect(outcome.result.mailed).toBe(0);
		expect(u.users.size).toBe(3);
		expect(u.staff.size).toBe(3);
		expect(
			outcome.result.errors.every((error: any) => error.stage === "mail"),
		).toBe(true);
		expect(u.journal.every((entry: any) => entry.status === "failed")).toBe(
			true,
		);
	});

	test("one bad row does not sink the batch", () => {
		const u = createTeamUniverse();
		// The second address is the one rp-staff will refuse.
		u.addStaff("maria@shop.test");
		u.failOn("staff", "updateStaff", "card is locked");

		const outcome = runWorkflow(source, { rawText: PASTED }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;

		expect(outcome.result.created).toBe(2);
		expect(outcome.result.failed).toBe(1);
		expect(outcome.result.staffIds).toHaveLength(2);
		expect(
			outcome.result.items.find((item: any) => item.email === "maria@shop.test")
				.reason,
		).toContain("card is locked");
	});

	test("the model wins when it answers, and the regex is skipped", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(
			source,
			{ rawText: PASTED, provider: "anthropic", model: "claude-opus-5" },
			u.handler,
			{
				llm: llm(
					'```json\n{"people":[{"email":"anna@shop.test","name":"Anna Sokolova"}]}\n```',
				),
			},
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.format).toBe("llm");
		expect(outcome.result.parsed).toBe(1);
		expect([...u.users.keys()]).toEqual(["anna@shop.test"]);
	});

	test("a model that answers with nothing falls back to the regex", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(
			source,
			{ rawText: PASTED, provider: "anthropic", model: "claude-opus-5" },
			u.handler,
			{ llm: llm("I could not find any people in that text.") },
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.format).toBe("text");
		expect(outcome.result.parsed).toBe(3);
	});

	test("reads an uploaded file the same way as pasted text", () => {
		const u = createTeamUniverse();
		u.addFile("file-1", "team.csv", "name,email\nIvan Petrov,ivan@shop.test");

		const outcome = runWorkflow(source, { fileIds: ["file-1"] }, u.handler);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.parsed).toBe(1);
		expect(outcome.result.sources[0]).toMatchObject({
			fileId: "file-1",
			name: "team.csv",
		});
		expect([...u.users.keys()]).toEqual(["ivan@shop.test"]);
	});

	test("dryRun reports what it would do and touches nothing", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(
			source,
			{ rawText: PASTED, dryRun: true },
			u.handler,
		);
		if (!outcome.ok) throw new Error(outcome.error);

		expect(outcome.result.status).toBe("dry-run");
		expect(outcome.result.parsed).toBe(3);
		expect(u.users.size).toBe(0);
		expect(u.staff.size).toBe(0);
		expect(u.invites.size).toBe(0);
	});

	test("an empty list is an answer, not a failure", () => {
		const u = createTeamUniverse();

		const outcome = runWorkflow(source, { rawText: "nobody here" }, u.handler);
		expect(outcome.ok).toBe(true);
		if (!outcome.ok) return;
		expect(outcome.result.status).toBe("empty");
		expect(outcome.result.parsed).toBe(0);
	});

	test("refuses a call with neither text nor files", () => {
		const u = createTeamUniverse();
		const outcome = runWorkflow(source, {}, u.handler);
		expect(outcome.ok).toBe(false);
		if (!outcome.ok) expect(outcome.error).toContain("params.rawText");
	});
});
