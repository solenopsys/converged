import { sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type {
	PaginationParams,
	WorkflowTrigger,
	WorkflowTriggerInput,
} from "g-dag";
import domain from "./domain-stats";
import dagService from "./service";

const listTriggersFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_TRIGGERS",
	handler: (params) => dagService.listTriggers(params),
});

export const $triggersStore = createInfiniteTableStore(domain, listTriggersFx);

export type TriggerDraft = {
	id?: string;
	name: string;
	topic: string;
	script: string;
	/** Raw JSON, parsed on save. */
	params: string;
	enabled: boolean;
	error: string | null;
};

const EMPTY_DRAFT: TriggerDraft = {
	name: "",
	topic: "",
	script: "",
	params: "{}",
	enabled: true,
	error: null,
};

export const openTriggerForm = domain.createEvent<{
	trigger?: WorkflowTrigger | null;
}>("OPEN_TRIGGER_FORM");
export const triggerFieldChanged = domain.createEvent<Partial<TriggerDraft>>(
	"TRIGGER_FIELD_CHANGED",
);
export const saveTriggerClicked = domain.createEvent("SAVE_TRIGGER_CLICKED");
export const deleteTriggerClicked = domain.createEvent(
	"DELETE_TRIGGER_CLICKED",
);
export const triggerFormClosed = domain.createEvent("TRIGGER_FORM_CLOSED");

const saveRejected = domain.createEvent<string>("TRIGGER_SAVE_REJECTED");

const createTriggerFx = domain.createEffect<WorkflowTriggerInput, unknown>({
	name: "CREATE_TRIGGER",
	handler: (input) => dagService.createTrigger(input),
});

const updateTriggerFx = domain.createEffect<
	{ id: string; input: WorkflowTriggerInput },
	unknown
>({
	name: "UPDATE_TRIGGER",
	handler: ({ id, input }) => dagService.updateTrigger(id, input),
});

const deleteTriggerFx = domain.createEffect<string, boolean>({
	name: "DELETE_TRIGGER",
	handler: (id) => dagService.deleteTrigger(id),
});

export const $triggerDraft = domain
	.createStore<TriggerDraft | null>(null)
	.on(openTriggerForm, (_, { trigger }) =>
		trigger
			? {
					id: trigger.id,
					name: trigger.name,
					topic: trigger.topic,
					script: trigger.script,
					params: JSON.stringify(trigger.params ?? {}, null, 2),
					enabled: trigger.enabled,
					error: null,
				}
			: { ...EMPTY_DRAFT },
	)
	.on(triggerFieldChanged, (draft, patch) =>
		draft ? { ...draft, ...patch, error: null } : draft,
	)
	.on(saveRejected, (draft, error) => (draft ? { ...draft, error } : draft))
	.reset([triggerFormClosed, createTriggerFx.done, deleteTriggerFx.done]);

export const $triggerSaving = domain
	.createStore(false)
	.on(
		[createTriggerFx.pending, updateTriggerFx.pending, deleteTriggerFx.pending],
		(_, pending) => pending,
	);

const validated = domain.createEvent<
	{ draft: TriggerDraft; input: WorkflowTriggerInput } | { error: string }
>("TRIGGER_VALIDATED");

sample({
	source: $triggerDraft,
	clock: saveTriggerClicked,
	filter: (draft): draft is TriggerDraft => Boolean(draft),
	fn: (draft) => {
		if (!draft.name.trim()) return { error: "Name is required" };
		if (!draft.topic.trim()) return { error: "Topic is required" };
		if (!draft.script.trim()) return { error: "Workflow is required" };
		const parsed = parseParams(draft.params);
		if (parsed.error) return { error: parsed.error };
		return {
			draft,
			input: {
				name: draft.name.trim(),
				topic: draft.topic.trim(),
				script: draft.script.trim(),
				params: parsed.value!,
				enabled: draft.enabled,
			},
		};
	},
	target: validated,
});

sample({
	clock: validated,
	filter: (payload) => "error" in payload,
	fn: (payload) => (payload as { error: string }).error,
	target: saveRejected,
});

sample({
	clock: validated,
	filter: (payload) => "draft" in payload && !payload.draft.id,
	fn: (payload) => (payload as { input: WorkflowTriggerInput }).input,
	target: createTriggerFx,
});

sample({
	clock: validated,
	filter: (payload) => "draft" in payload && Boolean(payload.draft.id),
	fn: (payload) => {
		const { draft, input } = payload as {
			draft: TriggerDraft;
			input: WorkflowTriggerInput;
		};
		return { id: draft.id!, input };
	},
	target: updateTriggerFx,
});

sample({
	source: $triggerDraft,
	clock: deleteTriggerClicked,
	filter: (draft): draft is TriggerDraft => Boolean(draft?.id),
	fn: (draft) => draft.id!,
	target: deleteTriggerFx,
});

// Any change reloads the list; the runtime is told separately, by rp-dag
// publishing on the bus.
sample({
	clock: [createTriggerFx.done, updateTriggerFx.done, deleteTriggerFx.done],
	fn: () => ({}),
	target: $triggersStore.reset,
});

sample({
	clock: [createTriggerFx.done, updateTriggerFx.done, deleteTriggerFx.done],
	fn: () => ({}),
	target: $triggersStore.loadMore,
});

type ParsedParams =
	| { value: Record<string, unknown>; error?: undefined }
	| { error: string; value?: undefined };

/** Parameters are typed as JSON, so a bad object is a message rather than a
 *  thrown error: the person is mid-edit, not wrong. */
function parseParams(raw: string): ParsedParams {
	const text = raw.trim();
	if (!text) return { value: {} };
	try {
		const value = JSON.parse(text);
		if (!value || typeof value !== "object" || Array.isArray(value))
			return { error: "Parameters must be a JSON object" };
		return { value: value as Record<string, unknown> };
	} catch (error) {
		return { error: `Invalid JSON: ${(error as Error).message}` };
	}
}
