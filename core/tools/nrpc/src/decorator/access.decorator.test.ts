import { describe, expect, test } from "bun:test";
import { Access, resolveMethodAccess } from "./access.decorator";

describe("Access", () => {
	test("keeps method metadata visible across separately bundled module copies", async () => {
		const anotherBundleCopy = await import("./access.decorator.ts?separate-bundle");

		class Service {
			read(): void {}
		}

		Access("public")(Service.prototype.read, { kind: "method" } as ClassMethodDecoratorContext);

		expect(anotherBundleCopy.resolveMethodAccess(Service.prototype, "read")).toBe(
			"public",
		);
	});

	test("uses class-level access when no method override exists", () => {
		class Service {
			write(): void {}
		}

		Access("internal")(Service, { kind: "class" } as ClassDecoratorContext);

		expect(resolveMethodAccess(Service.prototype, "write")).toBe("internal");
	});
});
