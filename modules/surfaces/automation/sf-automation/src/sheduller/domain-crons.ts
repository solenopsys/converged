import { sample } from "effector";
import { objectRef, presentReference } from "front-core/object-runtime";
import type { CronEntry, CronInput, CronUpdate } from "g-sheduller";
import domain from "./domain-stats";
import shedullerService from "./service";

export type CronDraft = {
	id?: string;
	name: string;
	expression: string;
	provider: string;
	action: string;
	topic: string;
	timezone: string;
	/** Raw JSON, parsed on save. */
	params: string;
	paused: boolean;
	error: string | null;
};

const EMPTY_DRAFT: CronDraft = {
	name: "",
	expression: "",
	provider: "",
	action: "",
	topic: "",
	timezone: "",
	params: "{}",
	paused: false,
	error: null,
};

export const openCronForm = domain.createEvent<{ cron?: CronEntry | null }>(
	"OPEN_CRON_FORM",
);
export const cronFieldChanged =
	domain.createEvent<Partial<CronDraft>>("CRON_FIELD_CHANGED");
export const saveCronClicked = domain.createEvent("SAVE_CRON_CLICKED");
export const deleteCronClicked = domain.createEvent("DELETE_CRON_CLICKED");
export const cronFormClosed = domain.createEvent("CRON_FORM_CLOSED");

/**
 * The list's own header button. It opens the blank form the way any record is
 * opened — as a reference, in its own tab — so "new" is just an id the detail
 * view knows.
 */
export const addCronClicked = domain.createEvent("ADD_CRON_CLICKED");
addCronClicked.watch(() => {
	void presentReference(objectRef("scheduler.cron", "new"));
});

const saveRejected = domain.createEvent<string>("CRON_SAVE_REJECTED");

const createCronFx = domain.createEffect<CronInput, unknown>({
	name: "CREATE_CRON",
	handler: (input) => shedullerService.createCron(input),
});

const updateCronFx = domain.createEffect<
	{ id: string; input: CronUpdate },
	unknown
>({
	name: "UPDATE_CRON",
	handler: ({ id, input }) => shedullerService.updateCron(id, input),
});

const deleteCronFx = domain.createEffect<string, boolean>({
	name: "DELETE_CRON",
	handler: (id) => shedullerService.deleteCron(id),
});

export const $cronDraft = domain
	.createStore<CronDraft | null>(null)
	.on(openCronForm, (_, { cron }) =>
		cron
			? {
					id: String(cron.id),
					name: cron.name ?? "",
					expression: cron.expression ?? "",
					provider: cron.provider ?? "",
					action: cron.action ?? "",
					topic: cron.topic ?? "",
					timezone: cron.timezone ?? "",
					params: JSON.stringify(cron.params ?? {}, null, 2),
					paused: cron.status === "paused",
					error: null,
				}
			: { ...EMPTY_DRAFT },
	)
	.on(cronFieldChanged, (draft, patch) =>
		draft ? { ...draft, ...patch, error: null } : draft,
	)
	.on(saveRejected, (draft, error) => (draft ? { ...draft, error } : draft))
	.reset([cronFormClosed, createCronFx.done, deleteCronFx.done]);

export const $cronSaving = domain
	.createStore(false)
	.on(
		[createCronFx.pending, updateCronFx.pending, deleteCronFx.pending],
		(_, pending) => pending,
	);

const validated = domain.createEvent<
	{ draft: CronDraft; input: CronInput } | { error: string }
>("CRON_VALIDATED");

sample({
	source: $cronDraft,
	clock: saveCronClicked,
	filter: (draft): draft is CronDraft => Boolean(draft),
	fn: (draft) => {
		if (!draft.name.trim()) return { error: "Name is required" };
		if (!draft.expression.trim()) return { error: "Expression is required" };
		if (!draft.provider.trim()) return { error: "Provider is required" };
		if (!draft.action.trim()) return { error: "Action is required" };
		const parsed = parseParams(draft.params);
		if (parsed.error) return { error: parsed.error };
		return {
			draft,
			input: {
				name: draft.name.trim(),
				expression: draft.expression.trim(),
				provider: draft.provider.trim(),
				action: draft.action.trim(),
				...(draft.topic.trim() ? { topic: draft.topic.trim() } : {}),
				...(draft.timezone.trim() ? { timezone: draft.timezone.trim() } : {}),
				params: parsed.value ?? {},
				status: draft.paused ? ("paused" as const) : ("active" as const),
			},
		};
	},
	target: validated,
});

sample({
	clock: validated,
	filter: (result): result is { error: string } => "error" in result,
	fn: (result) => result.error,
	target: saveRejected,
});

sample({
	clock: validated,
	filter: (result): result is { draft: CronDraft; input: CronInput } =>
		"draft" in result && !result.draft.id,
	fn: (result) => result.input,
	target: createCronFx,
});

sample({
	clock: validated,
	filter: (result): result is { draft: CronDraft; input: CronInput } =>
		"draft" in result && Boolean(result.draft.id),
	fn: (result) => ({ id: result.draft.id as string, input: result.input }),
	target: updateCronFx,
});

sample({
	source: $cronDraft,
	clock: deleteCronClicked,
	filter: (draft): draft is CronDraft => Boolean(draft?.id),
	fn: (draft) => draft.id as string,
	target: deleteCronFx,
});

/** The parameters field is free JSON; a bad object is the operator's to fix. */
function parseParams(raw: string): {
	value?: Record<string, unknown>;
	error?: string;
} {
	const text = raw.trim();
	if (!text) return { value: {} };
	try {
		const parsed = JSON.parse(text);
		if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
			return { error: "Parameters must be a JSON object" };
		return { value: parsed as Record<string, unknown> };
	} catch (error) {
		return {
			error: `Parameters are not valid JSON: ${
				error instanceof Error ? error.message : String(error)
			}`,
		};
	}
}
