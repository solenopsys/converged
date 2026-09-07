import { describe, expect, test } from "bun:test";
import { Access, resolveMethodAccess } from "./access.decorator";

describe("Access metadata", () => {
	test("method metadata overrides the class access level", () => {
		class ServiceImpl {
			publicMethod() {}
			defaultMethod() {}
		}

		Access("internal")(
			ServiceImpl,
			{ kind: "class" } as ClassDecoratorContext,
		);
		Access("public")(
			ServiceImpl.prototype.publicMethod,
			{ kind: "method" } as ClassMethodDecoratorContext,
		);

		expect(resolveMethodAccess(ServiceImpl.prototype, "publicMethod")).toBe("public");
		expect(resolveMethodAccess(ServiceImpl.prototype, "defaultMethod")).toBe("internal");
	});

	test("undecorated methods require user access", () => {
		class ServiceImpl {
			call() {}
		}
		expect(resolveMethodAccess(ServiceImpl.prototype, "call")).toBe("user");
	});

	test("does not read access from generated contract metadata", () => {
		class ServiceImpl {
			call() {}
		}

		expect(resolveMethodAccess(ServiceImpl.prototype, "call")).toBe("user");
	});
});
