import $ from "@solenopsys/converged-reactive";

export let UiEvents = $({ type: "Start" });

$.effect(() => {
	console.log("NEX EVENT", UiEvents());
});
