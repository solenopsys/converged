import { beforeAll, describe, expect, it } from "bun:test";
import { InMemoryMigrationState, SqlStore } from "back-core";
import requestsMigrations from "./stores/requests/migrations";
import { RequestsStoreService } from "./stores/requests/service";
import { loadBundledDefaultRequirements } from "./stores/requirements/service";
import type { RequestInput, RequestRequirementProfile } from "./types";

describe("RequestsService in-memory", () => {
	let store: SqlStore;
	let requests: RequestsStoreService;

	beforeAll(async () => {
		store = new SqlStore(
			":memory:",
			requestsMigrations,
			new InMemoryMigrationState(),
		);
		await store.open();
		await store.migrate();

		const catalog = await loadBundledDefaultRequirements();
		const profiles = new Map(
			catalog.profiles.map((profile) => [profile.processType, profile]),
		);
		const requirements = {
			getProfile: async (processType: RequestRequirementProfile["processType"]) =>
				profiles.get(processType),
			getProfileSync: (processType: RequestRequirementProfile["processType"]) =>
				profiles.get(processType),
			listProfiles: async () => Array.from(profiles.values()),
		};
		requests = new RequestsStoreService(store, requirements);
	});

	it("creates and reads a request", async () => {
		const input: RequestInput = {
			source: "landing",
			status: "new",
			fields: {
				name: "Alex",
				phone: "+1000000000",
				urgent: true,
			},
			files: {
				"file-1": "spec.pdf",
			},
		};

		const id = await requests.createRequest(input);
		const saved = await requests.getRequest(id);

		expect(saved).toBeDefined();
		expect(saved?.source).toBe("landing");
		expect(saved?.status).toBe("new");
		expect(saved?.fields.name).toBe("Alex");
		expect(saved?.files["file-1"]).toBe("spec.pdf");
	});

	it("lists requests with source filter", async () => {
		await requests.createRequest({
			source: "landing",
			fields: { name: "A" },
			files: {},
		});
		await requests.createRequest({
			source: "widget",
			fields: { name: "B" },
			files: {},
		});

		const list = await requests.listRequests({
			offset: 0,
			limit: 10,
			source: "landing",
		});

		expect(list.items.length).toBeGreaterThan(0);
		expect(list.items.every((item) => item.source === "landing")).toBe(true);
	});

	it("updates status and records processing log", async () => {
		const id = await requests.createRequest({
			source: "widget",
			fields: { name: "Client" },
			files: {},
		});

		await requests.updateStatus(id, "in_progress", "operator-1", "picked up");

		const updated = await requests.getRequest(id);
		expect(updated?.status).toBe("in_progress");

		const log = await requests.listProcessing(id);
		expect(log.length).toBe(1);
		expect(log[0].actor).toBe("operator-1");
		expect(log[0].comment).toBe("picked up");
		expect(log[0].status).toBe("in_progress");
	});

	it("patches request fields/files and records processing log", async () => {
		const id = await requests.createRequest({
			source: "assistant:cnc-request",
			status: "draft",
			fields: {
				material: "aluminum",
				quantity: 1,
			},
			files: {
				original: "file-1",
			},
		});

		await requests.patchRequest(
			id,
			{
				status: "new",
				fields: {
					quantity: 3,
					tolerances: "ISO 2768-m",
				},
				files: {
					preview: "file-2",
				},
			},
			"assistant",
			"request completed",
		);

		const updated = await requests.getRequest(id);
		expect(updated?.status).toBe("new");
		expect(updated?.fields.material).toBe("aluminum");
		expect(updated?.fields.quantity).toBe(3);
		expect(updated?.fields.tolerances).toBe("ISO 2768-m");
		expect(updated?.files.original).toBe("file-1");
		expect(updated?.files.preview).toBe("file-2");

		const log = await requests.listProcessing(id);
		expect(log.length).toBe(1);
		expect(log[0].actor).toBe("assistant");
		expect(log[0].comment).toBe("request completed");
		expect(log[0].status).toBe("new");
	});

	it("creates and enriches a dynamic server request model", async () => {
		const model = await requests.createRequestModel({
			source: "assistant:cnc-request",
			status: "draft",
			processType: "cnc_machining",
			parameters: [
				{
					key: "part_description",
					label: "Деталь",
					value: "Корпус модуля приложения",
					required: true,
					group: "basic",
				},
				{
					key: "quantity",
					label: "Количество",
					value: 100,
					type: "number",
					required: true,
					group: "basic",
				},
				{
					key: "surface_finish",
					label: "Шероховатость",
					value: "Ra 1.6",
					type: "surface_finish",
					group: "quality",
				},
			],
			fieldDefinitions: [
				{
					key: "inspection_report",
					label: "Отчет контроля качества",
					type: "boolean",
					group: "quality",
					required: false,
				},
			],
		});

		expect(model.processType).toBe("cnc_machining");
		expect(model.fields.quantity.value).toBe(100);
		expect(model.fields.inspection_report).toBeDefined();
		expect(model.missingRequired).toContain("material");
		expect(model.remainingRequired).toContain("material");
		expect(model.remainingDelta.some((field) => field.key === "material")).toBe(
			true,
		);
		expect(model.completion.required).toBeGreaterThan(0);

		const updated = await requests.applyRequestUpdate(
			model.id,
			{
				parameters: [
					{
						key: "material",
						label: "Материал",
						value: "PA6",
						type: "material",
						required: true,
						group: "basic",
					},
				],
				files: {
					model: "file-1",
				},
			},
			"assistant",
			"material and file added",
		);

		expect(updated.fields.material.value).toBe("PA6");
		expect(updated.files.model).toBe("file-1");
		expect(updated.revision).toBe(model.revision + 1);

		const saved = await requests.getRequest(updated.id);
		expect(saved?.model?.fields.material.value).toBe("PA6");
		expect(saved?.fields.material).toBe("PA6");
	});

	it("uses JSON requirements to infer 3D printing and normalize aliases", async () => {
		const model = await requests.createRequestModel({
			source: "assistant:request",
			status: "draft",
			summary: "Хочу распечатать 10 кубиков из ABS",
			fields: {
				описание: "Кубики",
				материал: "ABS",
				шт: 10,
			},
		});

		expect(model.processType).toBe("3d_printing");
		expect(model.fields.part_description.value).toBe("Кубики");
		expect(model.fields.material.value).toBe("ABS");
		expect(model.fields.quantity.value).toBe(10);
		expect(model.remainingRequired).toContain("dimensions");
		expect(model.remainingDelta.map((field) => field.key)).toEqual(["dimensions"]);
	});

	it("replaces a previously collected material field", async () => {
		const model = await requests.createRequestModel({
			source: "assistant:request",
			status: "draft",
			processType: "3d_printing",
			summary: "мне нужно распечатать 10 кубиков из пластика",
			fields: {
				part_description: "Кубики",
				material: "PLA",
				quantity: 10,
			},
		});

		const updated = await requests.applyRequestUpdate(
			model.id,
			{
				fields: {
					material: "ABS",
				},
			},
			"assistant",
			"material changed",
		);

		expect(updated.fields.material.value).toBe("ABS");

		const saved = await requests.getRequestModel(model.id);
		expect(saved?.fields.material.value).toBe("ABS");
		expect(saved?.fields.quantity.value).toBe(10);
	});
});
