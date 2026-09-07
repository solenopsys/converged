import { sample } from "effector";
import { createInfiniteTableStore } from "front-core";
import type { PaginationParams } from "g-dag";
import domain from "./domain-stats";
import runtimeService from "./runtime-service";
import dagService from "./service";

const listWorkflowsFx = domain.createEffect<PaginationParams, any>({
	name: "LIST_WORKFLOWS",
	handler: (params) => dagService.listWorkflows(params),
});

export const $workflowsStore = createInfiniteTableStore(
	domain,
	listWorkflowsFx,
);

// ---- running a workflow by hand --------------------------------------------

export type RunForm = {
	script: string;
	/** Raw JSON, exactly as typed. It is parsed when the run is submitted and
	 *  not before, so a half-written object does not fight the person typing. */
	params: string;
	error: string | null;
};

export const openRunForm = domain.createEvent<{ script: string }>(
	"OPEN_RUN_FORM",
);
export const paramsChanged = domain.createEvent<string>("RUN_PARAMS_CHANGED");
export const runClicked = domain.createEvent("RUN_CLICKED");
export const runFormClosed = domain.createEvent("RUN_FORM_CLOSED");

const runAccepted = domain.createEvent<{
	script: string;
	params: Record<string, unknown>;
}>("RUN_ACCEPTED");
const runRejected = domain.createEvent<string>("RUN_REJECTED");

export const runWorkflowFx = domain.createEffect<
	{ script: string; params: Record<string, unknown> },
	{ executionId: string }
>({
	name: "RUN_WORKFLOW",
	handler: async ({ script, params }) => {
		const result: any = await runtimeService.runWorkflow(script, params);
		return {
			executionId: String(result?.executionId ?? result?.execId ?? ""),
		};
	},
});

export const $runForm = domain
	.createStore<RunForm | null>(null)
	.on(openRunForm, (_, { script }) => ({ script, params: "{}", error: null }))
	.on(paramsChanged, (form, params) =>
		form ? { ...form, params, error: null } : form,
	)
	.on(runRejected, (form, error) => (form ? { ...form, error } : form))
	.on(runWorkflowFx.failData, (form, error) =>
		form
			? { ...form, error: String((error as Error)?.message ?? error) }
			: form,
	)
	.reset(runFormClosed);

/** The run this screen just started, so the UI can offer to open its log. */
export const $lastRun = domain
	.createStore<{ script: string; executionId: string } | null>(null)
	.on(runWorkflowFx.done, (_, { params, result }) => ({
		script: params.script,
		executionId: result.executionId,
	}))
	.reset([openRunForm, runFormClosed]);

/** Parsed once, on submit: valid parameters start a run, invalid ones become
 *  the message under the field. */
const runSubmitted = domain.createEvent<
	| { accepted: { script: string; params: Record<string, unknown> } }
	| { rejected: string }
>("RUN_SUBMITTED");

sample({
	source: $runForm,
	clock: runClicked,
	filter: (form): form is RunForm => Boolean(form),
	fn: (form) => {
		const parsed = parseParams(form.params);
		if (parsed.error) return { rejected: parsed.error };
		return { accepted: { script: form.script, params: parsed.value! } };
	},
	target: runSubmitted,
});

sample({
	clock: runSubmitted,
	filter: (payload) => "accepted" in payload,
	fn: (payload) =>
		(
			payload as {
				accepted: { script: string; params: Record<string, unknown> };
			}
		).accepted,
	target: runAccepted,
});

sample({
	clock: runSubmitted,
	filter: (payload) => "rejected" in payload,
	fn: (payload) => (payload as { rejected: string }).rejected,
	target: runRejected,
});

sample({ clock: runAccepted, target: runWorkflowFx });

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
