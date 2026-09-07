import { createDomain, sample } from "effector";
import { objectRef, presentReference } from "front-core/object-runtime";
import type {
	WebhookEndpoint,
	WebhookEndpointInput,
	WebhookEndpointUpdate,
	WebhookVerification,
} from "g-webhooks";
import webhooksService from "./service";

const domain = createDomain("webhooks-endpoints");

export type EndpointDraft = {
	id?: string;
	name: string;
	provider: string;
	slug: string;
	topic: string;
	verify: WebhookVerification;
	/** Raw JSON, parsed on save. */
	params: string;
	enabled: boolean;
	error: string | null;
};

const EMPTY_DRAFT: EndpointDraft = {
	name: "",
	provider: "",
	slug: "",
	topic: "",
	verify: "none",
	params: "{}",
	enabled: true,
	error: null,
};

export const openEndpointForm = domain.createEvent<{
	endpoint?: WebhookEndpoint | null;
}>("OPEN_ENDPOINT_FORM");
export const endpointFieldChanged = domain.createEvent<Partial<EndpointDraft>>(
	"ENDPOINT_FIELD_CHANGED",
);
export const saveEndpointClicked = domain.createEvent("SAVE_ENDPOINT_CLICKED");
export const deleteEndpointClicked = domain.createEvent(
	"DELETE_ENDPOINT_CLICKED",
);
export const endpointFormClosed = domain.createEvent("ENDPOINT_FORM_CLOSED");

/**
 * The list's own header button. It opens the blank form the way any record is
 * opened — as a reference, in its own tab — so "new" is just an id the detail
 * view knows.
 */
export const addEndpointClicked = domain.createEvent("ADD_ENDPOINT_CLICKED");
addEndpointClicked.watch(() => {
	void presentReference(objectRef("webhooks.endpoint", "new"));
});

const saveRejected = domain.createEvent<string>("ENDPOINT_SAVE_REJECTED");

const createEndpointFx = domain.createEffect<WebhookEndpointInput, unknown>({
	name: "CREATE_ENDPOINT",
	handler: (input) => webhooksService.createEndpoint(input),
});

const updateEndpointFx = domain.createEffect<
	{ id: string; input: WebhookEndpointUpdate },
	unknown
>({
	name: "UPDATE_ENDPOINT",
	handler: ({ id, input }) => webhooksService.updateEndpoint(id, input),
});

const deleteEndpointFx = domain.createEffect<string, boolean>({
	name: "DELETE_ENDPOINT",
	handler: (id) => webhooksService.deleteEndpoint(id),
});

export const $endpointDraft = domain
	.createStore<EndpointDraft | null>(null)
	.on(openEndpointForm, (_, { endpoint }) =>
		endpoint
			? {
					id: String(endpoint.id),
					name: endpoint.name ?? "",
					provider: endpoint.provider ?? "",
					slug: endpoint.slug ?? "",
					topic: endpoint.topic ?? "",
					verify: endpoint.verify ?? "none",
					params: JSON.stringify(endpoint.params ?? {}, null, 2),
					enabled: endpoint.enabled ?? true,
					error: null,
				}
			: { ...EMPTY_DRAFT },
	)
	.on(endpointFieldChanged, (draft, patch) =>
		draft ? { ...draft, ...patch, error: null } : draft,
	)
	.on(saveRejected, (draft, error) => (draft ? { ...draft, error } : draft))
	.reset([endpointFormClosed, createEndpointFx.done, deleteEndpointFx.done]);

export const $endpointSaving = domain
	.createStore(false)
	.on(
		[
			createEndpointFx.pending,
			updateEndpointFx.pending,
			deleteEndpointFx.pending,
		],
		(_, pending) => pending,
	);

const validated = domain.createEvent<
	{ draft: EndpointDraft; input: WebhookEndpointInput } | { error: string }
>("ENDPOINT_VALIDATED");

sample({
	source: $endpointDraft,
	clock: saveEndpointClicked,
	filter: (draft): draft is EndpointDraft => Boolean(draft),
	fn: (draft) => {
		if (!draft.name.trim()) return { error: "Name is required" };
		if (!draft.provider.trim()) return { error: "Provider is required" };
		const parsed = parseParams(draft.params);
		if (parsed.error) return { error: parsed.error };
		return {
			draft,
			input: {
				name: draft.name.trim(),
				provider: draft.provider.trim(),
				// Both are derived by the service when left empty: the slug from
				// the name, the topic from provider and slug.
				...(draft.slug.trim() ? { slug: draft.slug.trim() } : {}),
				...(draft.topic.trim() ? { topic: draft.topic.trim() } : {}),
				verify: draft.verify,
				params: parsed.value ?? {},
				enabled: draft.enabled,
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
	filter: (
		result,
	): result is { draft: EndpointDraft; input: WebhookEndpointInput } =>
		"draft" in result && !result.draft.id,
	fn: (result) => result.input,
	target: createEndpointFx,
});

sample({
	clock: validated,
	filter: (
		result,
	): result is { draft: EndpointDraft; input: WebhookEndpointInput } =>
		"draft" in result && Boolean(result.draft.id),
	fn: (result) => ({ id: result.draft.id as string, input: result.input }),
	target: updateEndpointFx,
});

sample({
	source: $endpointDraft,
	clock: deleteEndpointClicked,
	filter: (draft): draft is EndpointDraft => Boolean(draft?.id),
	fn: (draft) => draft.id as string,
	target: deleteEndpointFx,
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
