import { beforeEach, describe, expect, test } from "bun:test";
import {
	referencePresented,
	type SetRef,
	type ViewDefinition,
} from "front-core/object-runtime";
import { $activeWorkspaceTab, workspaceReset } from "./workspace";
import "./reference-presenter";

const View = () => null;

const reference: SetRef = {
	kind: "set",
	type: "companies.company",
	selection: { kind: "query", filter: { status: { eq: "active" } } },
};

const view: ViewDefinition = {
	id: "companies.company.table",
	accepts: { kind: "set", type: "companies.company" },
	component: View,
};

describe("reference presenter", () => {
	beforeEach(() => workspaceReset());

	test("passes the domain reference as a regular component prop", () => {
		referencePresented({ ref: reference, view, options: {} });

		expect($activeWorkspaceTab.getState()?.props).toMatchObject({ reference });
		expect($activeWorkspaceTab.getState()?.props.ref).toBeUndefined();
	});
});
