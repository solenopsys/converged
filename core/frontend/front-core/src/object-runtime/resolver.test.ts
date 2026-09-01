import { describe, expect, test } from "bun:test";
import { setOperationAuthorizationController } from "./authorization";
import { ObjectRegistry } from "./registry";
import { ObjectResolver } from "./resolver";
import { Category, objectOf, objectRef, setOf, setRef } from "./types";

function fixture() {
	const registry = new ObjectRegistry();
	registry.register("mf-companies", {
		id: "mf-companies",
		types: [
			{
				id: "companies.company",
				label: "Company",
				pluralLabel: "Companies",
				categories: [Category.Business, Category.Selectable],
			},
		],
		views: [
			{
				id: "companies.company",
				accepts: objectOf("companies.company"),
				component: () => null,
			},
			{
				id: "companies.companies",
				accepts: setOf("companies.company"),
				component: () => null,
			},
		],
		operations: [],
	});
	registry.register("mf-sales", {
		id: "mf-sales",
		types: [
			{
				id: "sales.outreach",
				label: "Outreach",
				categories: [Category.Business, Category.Creatable],
			},
		],
		views: [],
		operations: [
			{
				id: "sales.outreach.create",
				operator: "create",
				target: "sales.outreach",
				label: "Create outreach",
				inputs: [{ name: "companies", accepts: setOf("companies.company") }],
				output: objectOf("sales.outreach"),
				invoke: () => objectRef("sales.outreach", "1"),
			},
		],
	});
	registry.register("mf-outreach-view", {
		id: "mf-outreach-view",
		types: [],
		views: [
			{
				id: "sales.outreach.detail",
				accepts: objectOf("sales.outreach"),
				component: () => null,
			},
		],
		operations: [],
	});
	return { registry, resolver: new ObjectResolver(registry) };
}

describe("ObjectResolver", () => {
	test("keeps internal candidates for the assistant but hides them from a guest panel", () => {
		const { registry, resolver } = fixture();
		registry.register("mf-public", {
			id: "mf-public",
			types: [
				{
					id: "public.notice",
					label: "Public notice",
					categories: [Category.Selectable],
					access: "public",
				},
			],
			views: [],
			operations: [],
		});
		setOperationAuthorizationController({
			snapshot: () => ({ session: "guest" }),
			ensureSession: async () => undefined,
			authenticate: async () => undefined,
			can: () => false,
		});

		expect(
			resolver.resolve("select").map((candidate) => candidate.targetType),
		).toContain("companies.company");
		expect(
			resolver
				.resolve("select", { discovery: "panel" })
				.map((candidate) => candidate.targetType),
		).toEqual(["public.notice"]);

		setOperationAuthorizationController(null);
	});

	test("discovers selectable types for the select operator", () => {
		const { resolver } = fixture();
		expect(
			resolver.resolve("select").map((candidate) => candidate.targetType),
		).toEqual(["companies.company"]);
	});

	test("matches operations against typed references", () => {
		const { resolver } = fixture();
		const references = [
			setRef("companies.company", { kind: "ids", ids: ["a", "b"] }),
		];
		expect(
			resolver
				.resolve("create", { references })
				.map((candidate) => candidate.id),
		).toContain("sales.outreach.create");
		expect(
			resolver
				.resolve("create", { references })
				.find((candidate) => candidate.id === "sales.outreach.create")?.label,
		).toBe("Outreach");
		expect(
			resolver
				.resolve("create", {
					references: [objectRef("companies.company", "a")],
				})
				.map((candidate) => candidate.id),
		).not.toContain("sales.outreach.create");
	});

	test("offers open only for the object in the current context", () => {
		const { resolver } = fixture();
		expect(resolver.resolve("open")).toEqual([]);
		expect(
			resolver
				.resolve("open", {
					references: [objectRef("companies.company", "a")],
				})
				.map((candidate) => candidate.targetType),
		).toEqual(["companies.company"]);
	});

	test("omits dynamically undiscoverable types and operations", () => {
		const { registry, resolver } = fixture();
		let visible = false;
		registry.register("mf-session", {
			id: "mf-session",
			types: [
				{
					id: "auth.session",
					label: "Session",
					discover: () => visible,
				},
			],
			views: [
				{
					id: "auth.session.login",
					accepts: objectOf("auth.session"),
					component: () => null,
				},
			],
			operations: [
				{
					id: "auth.session.login",
					operator: "open",
					target: "auth.session",
					label: "Login",
					discover: () => visible,
				},
			],
		});

		expect(resolver.resolve("open")).toEqual([]);
		visible = true;
		expect(resolver.resolve("open").map(({ id }) => id)).toEqual([
			"auth.session.login",
		]);
	});

	test("resolves views by reference cardinality", () => {
		const { resolver } = fixture();
		expect(resolver.resolveView(objectRef("companies.company", "a"))?.id).toBe(
			"companies.company",
		);
		expect(
			resolver.resolveView(
				setRef("companies.company", { kind: "query" }),
			)?.id,
		).toBe("companies.companies");
	});

	test("treats omitted categories as an empty set", () => {
		const { registry, resolver } = fixture();
		registry.register("mf-contexts", {
			id: "mf-contexts",
			types: [{ id: "contexts.context", label: "Context" }],
			views: [],
			operations: [],
		});

		expect(resolver.resolve("select")).not.toContainEqual(
			expect.objectContaining({ targetType: "contexts.context" }),
		);
	});
});
