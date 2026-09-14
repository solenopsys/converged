// Mock requests / orders / events universe for the wf-request-to-order tests
// (test-only, never bundled). Each service keeps just enough state to answer the
// question the workflow asks, so the assertions are about the cascade — the
// order carrying the requestId, the request following it, the journal line —
// rather than about any one repository.

export type ConversionUniverse = {
	models: Map<string, any>;
	orders: Map<string, any>;
	events: any[];
	calls: string[];

	addRequest(id: string, model: Partial<any>): void;
	addOrder(requestId: string, modelName?: string): string;
	failOn(service: string, method: string, message: string): void;
	handler(service: string, method: string, params: any): unknown;
};

export function createConversionUniverse(): ConversionUniverse {
	const failures = new Map<string, string>();
	let seq = 0;
	const nextId = (prefix: string) => `${prefix}-${++seq}`;

	const u: ConversionUniverse = {
		models: new Map(),
		orders: new Map(),
		events: [],
		calls: [],

		addRequest(id, model) {
			u.models.set(id, {
				id,
				status: "ready",
				processType: "generic",
				fields: {},
				files: {},
				...model,
			});
		},

		addOrder(requestId, modelName = "Existing job") {
			const id = nextId("order");
			u.orders.set(id, {
				id,
				requestId,
				modelName,
				productionMethod: "generic",
				status: "queued",
				quantity: 1,
			});
			return id;
		},

		failOn(service, method, message) {
			failures.set(`${service}.${method}`, message);
		},

		handler(service, method, params) {
			const key = `${service}.${method}`;
			u.calls.push(key);
			const failure = failures.get(key);
			if (failure) throw new Error(failure);

			switch (key) {
				case "requests.getRequestModel":
					return u.models.get(params.id) ?? null;
				case "requests.updateStatus": {
					const model = u.models.get(params.id);
					if (!model) throw new Error(`request not found: ${params.id}`);
					model.status = params.status;
					return null;
				}

				case "orders.listOrders": {
					const items = [...u.orders.values()].filter((order) =>
						params.params.requestId
							? order.requestId === params.params.requestId
							: true,
					);
					return {
						items: items.slice(0, params.params.limit),
						totalCount: items.length,
					};
				}
				case "orders.createOrder": {
					const id = nextId("order");
					u.orders.set(id, {
						id,
						status: "draft",
						quantity: 1,
						...params.input,
					});
					return id;
				}

				case "events.publish": {
					const id = nextId("event");
					u.events.push({ id, ...params.input });
					return id;
				}

				default:
					throw new Error(`unexpected call ${key}`);
			}
		},
	};

	return u;
}
