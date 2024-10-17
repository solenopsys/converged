//@ts-nocheck
import { test, expect, describe } from "bun:test";
import { browserResolvePackage } from "../src/tools/resolve";

describe("math", () => {
	test("standard", async () => {
		const res = await browserResolvePackage(
			"@solenopsys/converged-renderer",
			"../configuration",
		);
		expect(res).toEqual("@solenopsys/converged-renderer/dist/index.js");
	});
	test("sub", async () => {
		const res = await browserResolvePackage("@solenopsys/converged-reactive", 	"../configuration");
		expect(res).toEqual("@solenopsys/converged-reactive/dist/index.js");
	});
});
