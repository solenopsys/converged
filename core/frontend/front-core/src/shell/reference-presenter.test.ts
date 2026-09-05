import { beforeEach, describe, expect, test } from "bun:test";
import {
	referencePresented,
	registerSurface,
	type ObjectRef,
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
			key: "projection:companies.company.table",
			permanent: true,
		});
	});

	test("reuses the permanent button for an unfiltered set", () => {
		referencePresented({ ref: defaultReference, view, options: {} });

		expect($pressedSubtab.getState()).toMatchObject({
			key: "projection:companies.company.table",
			permanent: true,
		});
	});

	test("names an object tab with its type and row title", () => {
		referencePresented({ ref: objectReference, view: objectView, options: {} });

		expect($pressedSubtab.getState()?.title).toBe("Item[example]");
	});
});
