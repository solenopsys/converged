// Mock equipment / orders / events / pushrouter universe for the
// wf-equipment-incident tests (test-only, never bundled). Each service keeps
// just enough state to answer what the workflow asks, so the assertions are
// about the cascade — the slot released, the job blocked, the floor told —
// rather than about any one repository.

export type IncidentUniverse = {
	machines: Map<string, any>;
	slots: Map<string, any>;
	orders: Map<string, any>;
	logs: any[];
	events: any[];
	pushes: any[];
	calls: string[];

	addMachine(id: string, machine?: Partial<any>): void;
	addSlot(slot: Partial<any> & { equipmentId: string }): string;
	addOrder(id: string, status?: string): void;
	failOn(service: string, method: string, message: string): void;
	handler(service: string, method: string, params: any): unknown;
};

export function createIncidentUniverse(): IncidentUniverse {
	const failures = new Map<string, string>();
	let seq = 0;
	const nextId = (prefix: string) => `${prefix}-${++seq}`;

	const u: IncidentUniverse = {
		machines: new Map(),
		slots: new Map(),
		orders: new Map(),
		logs: [],
		events: [],
		pushes: [],
		calls: [],

		addMachine(id, machine = {}) {
			u.machines.set(id, { id, kind: "fdm", status: "running", ...machine });
		},

		addSlot(slot) {
			const id = slot.id ?? nextId("slot");
			u.slots.set(id, { id, status: "planned", ...slot });
			return id;
		},

		addOrder(id, status = "in_progress") {
			u.orders.set(id, { id, status, modelName: `Job ${id}` });
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
				case "equipment.getEquipment":
					return u.machines.get(params.id) ?? null;
				case "equipment.listSchedule": {
					const items = [...u.slots.values()].filter(
						(slot) => slot.equipmentId === params.params.equipmentId,
					);
					return { items, totalCount: items.length };
				}
				case "equipment.updateState": {
					const machine = u.machines.get(params.id);
					if (!machine) throw new Error(`Equipment not found: ${params.id}`);
					machine.status = params.state.status;
					return null;
				}
				case "equipment.addLog": {
					const id = nextId("log");
					u.logs.push({ id, ...params.input });
					return id;
				}
				case "equipment.patchScheduleSlot": {
					const slot = u.slots.get(params.id);
					if (!slot) throw new Error(`slot not found: ${params.id}`);
					Object.assign(slot, params.patch);
					return null;
				}

				case "orders.getOrder":
					return u.orders.get(params.id) ?? null;
				case "orders.updateStatus": {
					const order = u.orders.get(params.id);
					if (!order) throw new Error(`order not found: ${params.id}`);
					order.status = params.status;
					return null;
				}

				case "events.publish": {
					const id = nextId("event");
					u.events.push({ id, ...params.input });
					return id;
				}

				case "pushrouter.publish":
					u.pushes.push(params.message);
					return { id: nextId("push"), delivered: 1 };

				default:
					throw new Error(`unexpected call ${key}`);
			}
		},
	};

	return u;
}
