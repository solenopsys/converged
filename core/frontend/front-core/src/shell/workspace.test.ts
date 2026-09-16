import { beforeEach, describe, expect, test } from "bun:test";
import {
	ingestObjectIndex,
	objectOf,
	objectRegistry,
	registerSurface,
	setOf,
	surfaceConfigured,
} from "front-core/object-runtime";
import { localeSetRequested } from "../i18n";
import {
	$activeSubtabs,
	$activeSurface,
	$pressedSubtab,
	$surfaceTabs,
	menus,
	OVERVIEW,
	projectionKey,
	runCommandFx,
	subtabActivated,
	subtabClosed,
	subtabOpened,
	subtabReleased,
	surfaceClosed,
	surfaceMounted,
	surfacePinToggled,
	surfaces,
	workspaceReset,
} from "./workspace";

const View = () => null;
let projectionPrepared = 0;
let commandRuns = 0;

function declare(
	id: string,
	label: string,
	access: "public" | "user" = "public",
): void {
	objectRegistry.declare(id, {
		id,
		label,
		purpose: `Test surface ${label}`,
		types: [],
		views: [],
		// A surface is offered only when the session can reach something in it,
		// so a fixture needs one discoverable operation to exist at all.
		operations: [
			{
				id: `${id}.probe`,
				operator: "execute",
				label: `${label} probe`,
				access,
			},
		],
	});
}

declare("sf-ws-orders", "Orders");
declare("sf-ws-companies", "Companies");

registerSurface({
	id: "sf-ws-items",
	label: "Items",
	purpose: "A surface with views and no declared menu",
	types: [
		{ id: "ws.item", label: "Item", pluralLabel: "Items" },
		{ id: "ws.part", label: "Part", pluralLabel: "Parts" },
	],
	views: [
		{
			id: "ws.item.table",
			accepts: setOf("ws.item"),
			component: View,
			props: () => {
				projectionPrepared += 1;
				return {};
			},
		},
		{ id: "ws.part.table", accepts: setOf("ws.part"), component: View },
		{ id: "ws.item.detail", accepts: objectOf("ws.item"), component: View },
	],
	operations: [
		{
			id: "ws.item.create",
			operator: "create",
			target: "ws.item",
			label: "Create item",
			access: "public",
			invoke: () => {
				commandRuns += 1;
			},
		},
	],
});

registerSurface({
	id: "sf-ws-curated",
	label: "Curated",
	purpose: "A surface that declares its menu",
	menu: [
		{ view: "ws.lead.board", default: true },
		{ operation: "ws.lead.call" },
	],
	types: [{ id: "ws.lead", label: "Lead", pluralLabel: "Leads" }],
	views: [
		{ id: "ws.lead.table", accepts: setOf("ws.lead"), component: View },
		{
			id: "ws.lead.board",
			accepts: setOf("ws.lead"),
			label: "Board",
			component: View,
		},
	],
	operations: [
		{
			id: "ws.lead.call",
			operator: "execute",
			label: "Call a lead",
			access: "public",
			invoke: () => {
				commandRuns += 1;
			},
		},
	],
});

function open(surface: string, key: string): void {
	subtabOpened({ key, surface, title: key, view: View, props: {} });
}

const stripIds = () => $surfaceTabs.getState().map((tab) => tab.id);
const barIds = () => $activeSubtabs.getState().map((tab) => tab.id);

describe("the strip", () => {
	beforeEach(() => {
		workspaceReset();
		surfaces.cleared();
		menus.cleared();
		surfaceConfigured({
			surfaces: [
				{ id: "sf-ws-orders", order: 1 },
				{ id: "sf-ws-companies", order: 2 },
				{ id: "sf-ws-items", order: 3, enabled: true },
				{ id: "sf-ws-curated", order: 4, enabled: true },
			],
		});
	});

	test("a surface opens on its overview, and nothing else appears", () => {
		surfaceMounted("sf-ws-items");

		expect(stripIds()).toEqual(["sf-ws-items"]);
		expect(barIds()).toEqual([OVERVIEW]);
		expect($pressedSubtab.getState()).toBeNull();
	});

	test("opening another surface replaces one that is not pinned", () => {
		surfaceMounted("sf-ws-orders");
		surfaceMounted("sf-ws-companies");

		expect(stripIds()).toEqual(["sf-ws-companies"]);
		expect($activeSurface.getState()).toBe("sf-ws-companies");
	});

	test("a pinned surface stays, and keeps what is open in it", () => {
		surfaceMounted("sf-ws-items");
		subtabActivated(projectionKey("ws.item.table"));
		surfacePinToggled("sf-ws-items");
		surfaceMounted("sf-ws-orders");
		surfaceMounted("sf-ws-items");

		expect(stripIds()).toEqual(["sf-ws-items", "sf-ws-orders"]);
		expect($pressedSubtab.getState()?.key).toBe(projectionKey("ws.item.table"));
	});

	test("a surface pushed out is forgotten: it comes back on its overview", () => {
		surfaceMounted("sf-ws-items");
		subtabActivated(projectionKey("ws.item.table"));
		surfaceMounted("sf-ws-orders");
		surfaceMounted("sf-ws-items");

		expect(barIds()).toEqual([OVERVIEW]);
		expect($pressedSubtab.getState()).toBeNull();
	});

	test("closing the active surface leaves the last one in the strip active", () => {
		surfacePinToggled("sf-ws-orders");
		surfaceMounted("sf-ws-companies");
		surfaceClosed("sf-ws-companies");

		expect(stripIds()).toEqual(["sf-ws-orders"]);
		expect($activeSurface.getState()).toBe("sf-ws-orders");
	});

	test("going home keeps what the user pinned", () => {
		surfacePinToggled("sf-ws-companies");
		surfaceMounted("sf-ws-orders");
		workspaceReset();

		expect(stripIds()).toEqual(["sf-ws-companies"]);
		expect($activeSurface.getState()).toBeNull();
	});

	test("the + menu lists every offered surface, open or not", () => {
		surfaceMounted("sf-ws-orders");
		const entries = surfaces.$entries.getState();

		expect(entries.map((entry) => entry.id)).toEqual([
			"sf-ws-orders",
			"sf-ws-companies",
			"sf-ws-items",
			"sf-ws-curated",
		]);
		expect(entries[0]).toMatchObject({ open: true, active: true });
		expect(entries[1]).toMatchObject({ open: false });
	});

	test("a solution installed later shows up in the + menu without a reload", () => {
		surfaceConfigured({
			surfaces: [
				{ id: "sf-ws-orders", order: 1 },
				{ id: "sf-ws-late", order: 2 },
			],
		});
		expect(surfaces.$entries.getState().map((entry) => entry.id)).toEqual([
			"sf-ws-orders",
		]);

		declare("sf-ws-late", "Late");

		expect(surfaces.$entries.getState().map((entry) => entry.id)).toEqual([
			"sf-ws-orders",
			"sf-ws-late",
		]);
	});

	test("a surface open without being offered still has a tab", () => {
		surfaceConfigured({ surfaces: [{ id: "sf-ws-orders" }] });
		open("sf-ws-unlisted", "unlisted.view");

		// It is on screen: dropping its tab would leave the user looking at a
		// screen they cannot navigate away from.
		expect(stripIds()).toContain("sf-ws-unlisted");
	});

	test("a surface needing an account is still offered to a guest", () => {
		declare("sf-ws-private", "Private", "user");
		surfaceConfigured({
			surfaces: [{ id: "sf-ws-orders" }, { id: "sf-ws-private" }],
		});

		// Authorization is a step in the flow, not a filter on it: the guest is
		// shown the section and signs in when they try to open it.
		expect(surfaces.$entries.getState().map((entry) => entry.id)).toEqual([
			"sf-ws-orders",
			"sf-ws-private",
		]);
	});
});

describe("the bar inside a surface", () => {
	beforeEach(() => {
		workspaceReset();
		surfaces.cleared();
		menus.cleared();
		projectionPrepared = 0;
		commandRuns = 0;
		surfaceConfigured({
			surfaces: [
				{ id: "sf-ws-orders", order: 1 },
				{ id: "sf-ws-items", order: 2, enabled: true },
				{ id: "sf-ws-curated", order: 3, enabled: true },
			],
		});
	});

	test("without a declared menu, + offers the overview, the set views and the create commands", () => {
		surfaceMounted("sf-ws-items");

		expect(
			menus.current.$entries
				.getState()
				.map(({ id, label, kind }) => ({ id, label, kind })),
		).toEqual([
			{ id: OVERVIEW, label: "Overview", kind: "tab" },
			{ id: projectionKey("ws.item.table"), label: "Items", kind: "tab" },
			{ id: projectionKey("ws.part.table"), label: "Parts", kind: "tab" },
			{ id: "op:ws.item.create", label: "Create item", kind: "command" },
		]);
	});

	test("a projection prepares its data only when it is opened", () => {
		surfaceMounted("sf-ws-items");
		expect(projectionPrepared).toBe(0);

		menus.current.opened(projectionKey("ws.item.table"));

		expect(projectionPrepared).toBe(1);
		expect(barIds()).toEqual([projectionKey("ws.item.table")]);
		expect($pressedSubtab.getState()).toMatchObject({
			title: "Items",
			ref: { kind: "set", type: "ws.item", selection: { kind: "query" } },
		});
	});

	test("a record opened from a list replaces the transient tab", () => {
		surfaceMounted("sf-ws-items");
		menus.current.opened(projectionKey("ws.item.table"));
		open("sf-ws-items", "object:ws.item:1");
		open("sf-ws-items", "object:ws.item:2");

		expect(barIds()).toEqual(["object:ws.item:2"]);
		expect($pressedSubtab.getState()?.key).toBe("object:ws.item:2");
	});

	test("pinning a projection keeps it while records come and go", () => {
		surfaceMounted("sf-ws-items");
		menus.current.opened(projectionKey("ws.item.table"));
		menus.current.pinToggled(projectionKey("ws.item.table"));
		open("sf-ws-items", "object:ws.item:1");
		subtabActivated(projectionKey("ws.item.table"));

		expect(barIds()).toEqual([
			projectionKey("ws.item.table"),
			"object:ws.item:1",
		]);
		expect($pressedSubtab.getState()?.key).toBe(projectionKey("ws.item.table"));
	});

	test("closing the open record goes back to the overview", () => {
		surfaceMounted("sf-ws-items");
		open("sf-ws-items", "object:ws.item:1");
		subtabClosed("object:ws.item:1");

		expect(barIds()).toEqual([OVERVIEW]);
		expect($pressedSubtab.getState()).toBeNull();
	});

	test("releasing returns to the overview", () => {
		open("sf-ws-items", "object:ws.item:1");
		subtabReleased("sf-ws-items");

		expect(menus.current.$active.getState()).toBe(OVERVIEW);
		expect($pressedSubtab.getState()).toBeNull();
	});

	test("opening something presses it inside its own surface, not a new tab", () => {
		open("sf-ws-orders", "orders.list");

		expect(stripIds()).toEqual(["sf-ws-orders"]);
		expect($pressedSubtab.getState()?.key).toBe("orders.list");
	});

	test("a declared menu decides the order and where the surface opens", () => {
		surfaceMounted("sf-ws-curated");

		expect(menus.current.$entries.getState().map((entry) => entry.id)).toEqual([
			OVERVIEW,
			projectionKey("ws.lead.board"),
			"op:ws.lead.call",
		]);
		expect(menus.current.$active.getState()).toBe(
			projectionKey("ws.lead.board"),
		);
		expect($pressedSubtab.getState()?.title).toBe("Board");
	});

	test("a command runs and does not become a tab", async () => {
		surfaceMounted("sf-ws-curated");
		const finished = new Promise<void>((resolve) => {
			const subscription = runCommandFx.finally.watch(() => {
				subscription.unsubscribe();
				resolve();
			});
		});
		menus.current.opened("op:ws.lead.call");
		await finished;

		expect(commandRuns).toBe(1);
		expect(barIds()).toEqual([projectionKey("ws.lead.board")]);
	});

	test("what is pinned inside a surface outlives the surface being pushed out", () => {
		surfaceMounted("sf-ws-items");
		open("sf-ws-items", "object:ws.item:1");
		menus.current.pinToggled("object:ws.item:1");
		surfaceMounted("sf-ws-orders");
		surfaceMounted("sf-ws-items");

		expect(barIds()).toContain("object:ws.item:1");
		subtabActivated("object:ws.item:1");
		expect($pressedSubtab.getState()?.key).toBe("object:ws.item:1");
	});
});

describe("labels and descriptions are translated", () => {
	test("from the index, before the module loads, and they follow the language", () => {
		ingestObjectIndex({
			modules: {
				"ws-intl": {
					module: "sf-ws-intl",
					manifest: {
						id: "sf-ws-intl",
						label: "Files",
						labelKey: "surface.label",
						purpose: "Uploaded files",
						purposeKey: "surface.purpose",
						types: [
							{
								id: "intl.file",
								label: "File",
								pluralLabel: "Files",
								pluralLabelKey: "menu.files",
								description: "One uploaded file",
								descriptionKey: "types.file.description",
							},
						],
						// Labelled like its type: the translated type label has to win.
						views: [
							{
								id: "intl.file.table",
								accepts: setOf("intl.file"),
								label: "Files",
							},
						],
						operations: [
							{
								id: "intl.file.upload",
								operator: "execute",
								label: "Upload files",
								labelKey: "operations.upload.label",
								access: "public",
							},
						],
						menu: [
							{ view: "intl.file.table" },
							{ operation: "intl.file.upload" },
						],
					},
					locales: {
						en: {
							surface: { label: "Files", purpose: "Uploaded files" },
							menu: { files: "Files" },
							types: { file: { description: "One uploaded file" } },
							operations: { upload: { label: "Upload files" } },
						},
						ru: {
							surface: { label: "Файлы", purpose: "Загруженные файлы" },
							menu: { files: "Файлы" },
							types: { file: { description: "Один загруженный файл" } },
							operations: { upload: { label: "Загрузить файлы" } },
						},
					},
				},
			},
		});
		workspaceReset();
		surfaces.cleared();
		surfaceConfigured({ surfaces: [{ id: "sf-ws-intl" }] });
		surfaceMounted("sf-ws-intl");

		const entries = () =>
			menus.current.$entries
				.getState()
				.map(({ label, description }) => ({ label, description }));

		expect(surfaces.$entries.getState()[0]).toMatchObject({
			label: "Files",
			description: "Uploaded files",
		});
		expect(entries()).toEqual([
			{ label: "Overview", description: "Uploaded files" },
			{ label: "Files", description: "One uploaded file" },
			{ label: "Upload files", description: undefined },
		]);

		localeSetRequested("ru");
		try {
			expect(surfaces.$entries.getState()[0]).toMatchObject({
				label: "Файлы",
				description: "Загруженные файлы",
			});
			expect(entries().slice(1)).toEqual([
				{ label: "Файлы", description: "Один загруженный файл" },
				{ label: "Загрузить файлы", description: undefined },
			]);
		} finally {
			localeSetRequested("en");
		}
	});
});
