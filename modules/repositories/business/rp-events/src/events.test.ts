import { beforeEach, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import eventsMigrations from "./stores/events/migrations";
import { EventsStoreService } from "./stores/events/service";

describe("EventsStoreService", () => {
	let store: SqlStore;
	let events: EventsStoreService;

	beforeEach(async () => {
		store = new SqlStore(
			":memory:",
			eventsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();
		events = new EventsStoreService(store);
	});

	it("publishes and lists business event references", async () => {
		const requestEventId = await events.publish({
			createdAt: "2026-06-02T10:00:00.000Z",
			type: "request.created",
			service: "requests",
			entityId: "request-1",
		});

		await events.publish({
			createdAt: "2026-06-02T10:01:00.000Z",
			type: "chat.created",
			service: "assistant",
			entityId: "thread-1",
		});

		const all = await events.listEvents(0, 10);
		expect(all.map((event) => event.type)).toEqual([
			"chat.created",
			"request.created",
		]);
		expect(all[1].id).toBe(requestEventId);
		expect(all[1].entityId).toBe("request-1");
	});

	it("round-trips parentId/label and omits them when absent", async () => {
		await events.publish({
			createdAt: "2026-06-02T10:00:00.000Z",
			type: "file.created",
			service: "files",
			entityId: "file-1",
			parentId: "run-42",
			label: "report.stl",
		});
		await events.publish({
			createdAt: "2026-06-02T10:01:00.000Z",
			type: "chat.created",
			service: "assistant",
			entityId: "thread-1",
		});

		const [chat, file] = await events.listEvents(0, 10);
		expect(file.parentId).toBe("run-42");
		expect(file.label).toBe("report.stl");
		expect(chat.parentId).toBeUndefined();
		expect(chat.label).toBeUndefined();
	});
});
