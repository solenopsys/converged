import { describe, test, jest, expect, it } from "bun:test";

import $ from "@solenopsys/converged-reactive";
import { observable } from "@solenopsys/converged-reactive";
import { setTimeout as delay } from "node:timers/promises";
import { EntityName } from "typescript";
const tick = () => {
	return delay(1);
};


 
function is(value:any, expected:any){
    expect(value).toEqual(expected);
}

describe("Reactive", () => {
	it("creates a dependency in an effect when getting", async (t) => {
		const o = $(1);

		let calls = 0;

		$.effect(() => {
            console.log("EFFECT")
			calls += 1;
			o();
		});

   
		expect(calls).toEqual(0);

		await tick();
		expect(calls).toEqual(1);

		o(2);

		expect(calls).toEqual(1);
		await tick();
		expect(calls).toEqual(2);

		o(3);

		expect(calls).toEqual(2);
		await tick();
		expect(calls).toEqual(3);
	});
});


 