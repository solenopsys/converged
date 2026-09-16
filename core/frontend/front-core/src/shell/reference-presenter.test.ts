import { beforeEach, describe, expect, test } from "bun:test";
import {
	type ObjectRef,
	referencePresented,
	registerSurface,
	type SetRef,
	type ViewDefinition,
} from "front-core/object-runtime";
import { $pressedSubtab, workspaceReset } from "./workspace";
import "./reference-presenter";

const View = () => null;

const reference: SetRef = {
	kind: "set",
	type: "companies.company",
	selection: { kind: "query", filter: { status: { eq: "active" } } },
};

const defaultReference: SetRef = {
	kind: "set",
	type: "companies.company",
	selection: { kind: "query" },
};

const view: ViewDefinition = {
	id: "companies.company.table",
	accepts: { kind: "set", type: "companies.company" },
	component: View,
};

const objectView: ViewDefinition = {
	id: "presenter.item.detail",
	accepts: { kind: "object", type: "presenter.item" },
	component: View,
};

registerSurface({
	id: "sf-presenter-test",
	label: "Presenter test",
	purpose: "Reference presenter fixture",
	types: [{ id: "presenter.item", label: "Item" }],
	views: [objectView],
	operations: [],
});

const objectReference: ObjectRef = {
	kind: "object",
	type: "presenter.item",
	id: "42",
	title: "example",
};

describe("reference presenter", () => {
	beforeEach(() => workspaceReset());

	test("passes the domain reference as a regular component prop", () => {
		referencePresented({ ref: reference, view, options: {} });

		expect($pressedSubtab.getState()?.props).toMatchObject({ reference });
		expect($pressedSubtab.getState()?.props.ref).toBeUndefined();
		expect($pressedSubtab.getState()).toMatchObject({
			key: "view:companies.company.table",
		});
	});

	test("a set, filtered or not, lands on its projection's own tab", () => {
		referencePresented({ ref: reference, view, options: {} });
		referencePresented({ ref: defaultReference, view, options: {} });

		expect($pressedSubtab.getState()).toMatchObject({
			key: "view:companies.company.table",
			props: { reference: defaultReference },
		});
	});

	test("names an object tab with its type and row title", () => {
		referencePresented({ ref: objectReference, view: objectView, options: {} });

		expect($pressedSubtab.getState()?.title).toBe("Item[example]");
	});
});
