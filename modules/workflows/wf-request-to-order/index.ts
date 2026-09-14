// wf-request-to-order — the join the product is named after: an accepted
// request becomes a job on the shop floor.
//
// Three services move together and none of them may call the others. rp-requests
// does not know what an order is, rp-orders does not know what a request is, and
// rp-events knows about neither — so `Order.requestId`, the request's move to
// `in_production` and the line in the journal can only be written from here.
//
// Idempotent by lookup, not by bookkeeping: an order carrying this requestId is
// the evidence the conversion already happened, so a second run — a retry, a
// second click, the assistant asked twice — answers with the order that exists
// instead of a duplicate job. That is what makes it safe to publish to the chat.

import "dag-core/env";

import { createEventsServiceRtClient } from "g-events/rt";
import { createOrdersServiceRtClient } from "g-orders/rt";
import { createRequestsServiceRtClient } from "g-requests/rt";

const events = createEventsServiceRtClient();
const orders = createOrdersServiceRtClient();
const requests = createRequestsServiceRtClient();

/** The status a fresh job takes: queued work, not a draft somebody must finish. */
const INITIAL_STATUS = "queued";

/** Where the request goes once it has a job. */
const REQUEST_STATUS = "in_production";

const ACTOR = "wf-request-to-order";

/**
 * The request's process, as the machine that does it.
 *
 * Only `3d_printing` is genuinely ambiguous — it is every one of fdm/sla/sls —
 * and `fdm` is the shop's common case rather than a reading of the request. Both
 * that and `plastic_cutting`, which is the laser in practice, are overridable by
 * `productionMethod`, which is the point of the parameter.
 */
const METHOD_BY_PROCESS: Record<string, string> = {
	cnc_machining: "cnc",
	laser_cutting: "laser",
	plastic_cutting: "laser",
	"3d_printing": "fdm",
	generic: "generic",
};

/**
 * Request fields are free-form: their keys come from the requirement profiles a
 * shop seeds, so there is no field named `quantity` to read. Matching on a
 * substring finds "quantity", "qty_pieces" and "Количество" alike and costs
 * nothing when it misses — an order with no material is an ordinary order.
 */
const FIELD_ALIASES: Record<string, string[]> = {
	quantity: ["quantity", "qty", "количеств"],
	material: ["material", "материал"],
	weightGrams: ["weight", "масса", "вес"],
	dueAt: ["due", "deadline", "срок"],
	customerEmail: ["email", "почта", "e-mail"],
	customerName: ["customer", "client", "заказчик", "клиент"],
};

type Input = {
	requestId: string;
	/** Everything below overrides what the request says, for the case where the
	 *  person converting knows better than the form did. */
	productionMethod?: string;
	quantity?: number;
	material?: string;
	weightGrams?: number;
	dueAt?: string;
	equipmentId?: string;
	customerName?: string;
	customerEmail?: string;
	notes?: string;
};

function fieldValue(
	fields: Record<string, { value?: unknown }> | undefined,
	aliases: string[],
): unknown {
	if (!fields) return undefined;
	for (const key of Object.keys(fields)) {
		const normalized = key.toLowerCase();
		for (const alias of aliases) {
			if (normalized.includes(alias)) {
				const value = fields[key]?.value;
				if (value !== undefined && value !== null && value !== "") return value;
			}
		}
	}
	return undefined;
}

/** Free-form values arrive as "12 шт" as often as 12. */
function asNumber(value: unknown): number | undefined {
	if (typeof value === "number")
		return Number.isFinite(value) ? value : undefined;
	if (typeof value !== "string") return undefined;
	const match = value.replace(",", ".").match(/-?\d+(\.\d+)?/);
	if (!match) return undefined;
	const parsed = Number(match[0]);
	return Number.isFinite(parsed) ? parsed : undefined;
}

function asText(value: unknown): string | undefined {
	if (typeof value === "string") return value.trim() || undefined;
	if (typeof value === "number") return String(value);
	return undefined;
}

/** What the job is called on the floor. The title if the request has one, else
 *  the first file, because "part.stl" is a better label than an id. */
function modelNameOf(model: any, requestId: string): string {
	const title = asText(model?.title);
	if (title) return title;
	const files = model?.files ?? {};
	const firstFile = Object.keys(files)[0];
	if (firstFile) return firstFile;
	return `Request ${requestId}`;
}

rt.workflow = (input: Input) => {
	const requestId = String(input?.requestId ?? "").trim();
	if (!requestId) throw new Error("request-to-order requires params.requestId");

	// ---- 1. the request ------------------------------------------------------
	const model = rt.node(`read-request:${requestId}`, () =>
		requests.getRequestModel(requestId),
	);
	if (!model) throw new Error(`request not found: ${requestId}`);

	// ---- 2. already converted? ----------------------------------------------
	// The lookup is the idempotency: one request, one job.
	const existing = rt.node(`find-order:${requestId}`, () =>
		orders.listOrders({ offset: 0, limit: 1, requestId }),
	);
	const found = (existing.items ?? [])[0];
	if (found) {
		const result = {
			status: "exists",
			orderId: found.id,
			requestId,
			modelName: found.modelName,
			productionMethod: found.productionMethod,
			quantity: found.quantity,
		};
		rt.log(`request-to-order: ${requestId} already became ${found.id}`);
		return result;
	}

	// ---- 3. the order --------------------------------------------------------
	const fields = model.fields as Record<string, { value?: unknown }>;
	const processType = String(model.processType ?? "generic");
	const productionMethod =
		asText(input.productionMethod) ??
		METHOD_BY_PROCESS[processType] ??
		"generic";
	const quantity =
		input.quantity ?? asNumber(fieldValue(fields, FIELD_ALIASES.quantity)) ?? 1;
	const weightGrams =
		input.weightGrams ??
		asNumber(fieldValue(fields, FIELD_ALIASES.weightGrams));
	const material =
		asText(input.material) ??
		asText(fieldValue(fields, FIELD_ALIASES.material));
	const dueAt =
		asText(input.dueAt) ?? asText(fieldValue(fields, FIELD_ALIASES.dueAt));
	// The review funnel is the first thing that has to write to this person, and
	// a contact it has to be told on every run is a contact that is wrong.
	const customerEmail =
		asText(input.customerEmail) ??
		asText(fieldValue(fields, FIELD_ALIASES.customerEmail));
	const customerName =
		asText(input.customerName) ??
		asText(fieldValue(fields, FIELD_ALIASES.customerName));
	const modelName = modelNameOf(model, requestId);

	const created = rt.attempt(`create-order:${requestId}`, () =>
		orders.createOrder({
			requestId,
			modelName,
			productionMethod: productionMethod as any,
			status: INITIAL_STATUS as any,
			quantity,
			...(weightGrams !== undefined ? { weightGrams } : {}),
			...(material ? { material } : {}),
			...(dueAt ? { dueAt } : {}),
			...(input.equipmentId ? { equipmentId: String(input.equipmentId) } : {}),
			...(customerName ? { customerName } : {}),
			...(customerEmail ? { customerEmail } : {}),
			...(input.notes ? { notes: String(input.notes) } : {}),
		}),
	);
	if (!created.ok) throw new Error(created.error);
	const orderId = created.value;

	// ---- 4. the request follows the work ------------------------------------
	// A branch, not an exception: the job exists and is queued, and a request
	// left on its old status is a wrong label, not a lost order. Re-running
	// lands on step 2 and repairs it.
	const errors: { stage: string; message: string }[] = [];
	const moved = rt.attempt(`move-request:${requestId}`, () =>
		requests.updateStatus(requestId, REQUEST_STATUS, ACTOR),
	);
	if (!moved.ok) errors.push({ stage: "request-status", message: moved.error });

	// ---- 5. the journal ------------------------------------------------------
	const journaled = rt.attempt(`publish-event:${orderId}`, () =>
		events.publish({
			type: "order.created",
			service: "orders",
			entityId: orderId,
			parentId: requestId,
			label: modelName,
		}),
	);
	if (!journaled.ok) errors.push({ stage: "event", message: journaled.error });

	const result = {
		status: "created",
		orderId,
		requestId,
		modelName,
		productionMethod,
		quantity,
		requestStatus: moved.ok ? REQUEST_STATUS : String(model.status ?? ""),
		errors,
	};
	rt.set(`request-to-order:${requestId}`, result);
	rt.log(
		`request-to-order: ${requestId} -> ${orderId} (${productionMethod} x${quantity})`,
	);
	return result;
};
