import { describe, expect, test } from "bun:test";
import { vendorBuilds } from "./vendor";

describe("vendor transport boundary", () => {
	test("front-core imports the shared transport from the import map", () => {
		const frontCore = vendorBuilds.find(({ name }) => name === "front-core");
		expect(frontCore).toBeDefined();
		expect(frontCore?.external).toContain("signal-channel");
		expect(frontCore?.external).toContain("nrpc");
		expect(frontCore?.external).toContain("front-core/object-runtime");
	});

	test("object runtime has its own shared vendor module", () => {
		const runtime = vendorBuilds.find(
			({ name }) => name === "front-core-object-runtime",
		);
		expect(runtime).toMatchObject({
			outfile: "front-core-object-runtime.js",
			external: ["effector"],
		});
	});

	test("signal-channel is the only transport owner", () => {
		const owners = vendorBuilds
			.filter(({ name }) => name === "signal-channel")
			.map(({ outfile }) => outfile);
		expect(owners).toEqual(["signal-channel.js"]);
	});
});
