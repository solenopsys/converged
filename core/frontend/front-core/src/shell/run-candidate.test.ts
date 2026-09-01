import { beforeAll, describe, expect, test } from "bun:test";
import {
	Category,
	objectRegistry,
	referencePresented,
	setMicrofrontendLoader,
} from "front-core/object-runtime";
import { NEW, runCandidate } from "./run-candidate";

const Compose = () => null;
const Detail = () => null;
let executed = 0;

beforeAll(() => {
	setMicrofrontendLoader(async () => {});
	objectRegistry.register("mf-mailing", {
		id: "mf-mailing",
		types: [
			{ id: "mailing.mail", label: "Mail", categories: [Category.Creatable] },
			{ id: "calls.call", label: "Call", categories: [Category.Creatable] },
		],
		views: [
			// The composer deliberately ranks below the reader: an existing mail
			// opens for reading. Creation must not follow that ranking.
			{
				id: "mailing.mail.compose",
				accepts: { kind: "object", type: "mailing.mail" },
				component: Compose,
				priority: -10,
			},
			{
				id: "mailing.mail.detail",
				accepts: { kind: "object", type: "mailing.mail" },
				component: Detail,
			},
		],
		operations: [
			{
				id: "mailing.mail.create",
				operator: "create",
				target: "mailing.mail",
				label: "Send mail",
				access: "public",
				view: "mailing.mail.compose",
				invoke: () => {
					executed += 1;
				},
			},
			{
				id: "calls.call.create",
				operator: "create",
				target: "calls.call",
				label: "Start call",
				access: "public",
				invoke: () => {
					executed += 1;
				},
			},
		],
	});
});

const candidateFor = (operationId: string) => {
	const operation = objectRegistry.operation(operationId);
	if (!operation) throw new Error(`missing ${operationId}`);
	return {
		id: operation.id,
		kind: "operation" as const,
		operator: "create" as const,
		targetType: operation.target,
		label: operation.label,
		score: 0,
		operation,
	};
};

describe("running a resolved candidate", () => {
	test("create opens the screen the operation names, not the ranked view", async () => {
		const presented: string[] = [];
		const stop = referencePresented.watch(({ ref, view }) =>
			presented.push(`${view.id}:${ref.kind === "object" ? ref.id : ""}`),
		);
		const before = executed;

		await runCandidate("create", candidateFor("mailing.mail.create"));

		stop();
		expect(presented).toEqual([`mailing.mail.compose:${NEW}`]);
		// Composing is the screen's job; the operation runs when that screen says so.
		expect(executed).toBe(before);
	});

	test("a create with no screen is simply executed", async () => {
		const before = executed;
		await runCandidate("create", candidateFor("calls.call.create"));
		expect(executed).toBe(before + 1);
	});

	// A reference is a composition the user already made — "create an outreach
	// from these companies". Re-opening an empty screen would discard it.
	test("a create given a reference runs instead of opening its screen", async () => {
		const presented: string[] = [];
		const stop = referencePresented.watch(({ view }) => presented.push(view.id));
		const before = executed;

		await runCandidate("create", candidateFor("mailing.mail.create"), [
			{ kind: "set", type: "companies.company", selection: { kind: "ids", ids: ["1"] } },
		]);

		stop();
		expect(presented).toEqual([]);
		expect(executed).toBe(before + 1);
	});
});
