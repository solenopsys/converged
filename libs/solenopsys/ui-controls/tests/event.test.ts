import { describe, test, jest, expect } from "bun:test";
import { UiButton } from "../src";
import { render } from "@solenopsys/converged-renderer";

import $ from "@solenopsys/converged-reactive";
import { setTimeout as delay } from "node:timers/promises";
const tick = () => {
	return delay(1);
};

describe("Button", () => {
	test("dispatch click event", async () => {
	
		$.effect(() => {
			console.log("DOCUMENT", document.body.innerHTML);
		});

        console.log("ROOT");
		$.root(() => {
			//@ts-ignore
			render(UiButton({ title: "bla" }), document.body);
		});

		const button = document.querySelector("button");
		expect(button?.title).toEqual("bla");
        button?.addEventListener("click", () => console.log("CLICK"));
		button?.dispatchEvent(new MouseEvent("click"));

		console.log("STEP1");
		await tick();

		console.log("STEP2");
		await tick();
		console.log("STEP3");
		await tick();
	});
});
