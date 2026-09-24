import { afterEach, describe, expect, test } from "bun:test";
import {
	$tableColumnsState,
	columnWidthsRestored,
	persistTableColumnWidthsFx,
	resetColumnWidths,
	setColumnWidthAtIndex,
} from "./columns-store";

const STORAGE_KEY = "front-core:table-column-widths";
const originalStorage = Object.getOwnPropertyDescriptor(
	globalThis,
	"localStorage",
);

afterEach(() => {
	if (originalStorage)
		Object.defineProperty(globalThis, "localStorage", originalStorage);
	else delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe("table column width persistence", () => {
	test("persists Effector width changes to browser storage", async () => {
		let stored: string | null = null;
		Object.defineProperty(globalThis, "localStorage", {
			configurable: true,
			value: {
				getItem: (key: string) => (key === STORAGE_KEY ? stored : null),
				setItem: (key: string, value: string) => {
					if (key === STORAGE_KEY) stored = value;
				},
			},
		});

		const persisted = new Promise<void>((resolve) => {
			const stop = persistTableColumnWidthsFx.done.watch(() => {
				stop();
				resolve();
			});
		});
		setColumnWidthAtIndex({
			tableId: "persistence-test",
			index: 0,
			width: 245,
		});
		await persisted;

		expect(JSON.parse(stored ?? "{}").columnWidths["persistence-test"]).toEqual(
			[245],
		);
		resetColumnWidths({ tableId: "persistence-test" });
	});

	test("restores storage changes into the shared Effector store", () => {
		columnWidthsRestored({
			columnWidths: { "restored-test": [180, 320] },
		});

		expect($tableColumnsState.getState().columnWidths["restored-test"]).toEqual(
			[180, 320],
		);
		resetColumnWidths({ tableId: "restored-test" });
	});
});
