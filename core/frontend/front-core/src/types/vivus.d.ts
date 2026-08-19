declare module "vivus" {
	export type VivusType =
		| "delayed"
		| "sync"
		| "async"
		| "nsync"
		| "oneByOne"
		| "scenario"
		| "scenario-sync";

	export type VivusStart = "autostart" | "manual" | "inViewport";

	export interface VivusOptions {
		type?: VivusType;
		duration?: number;
		delay?: number;
		dashGap?: number;
		start?: VivusStart;
		reverseStack?: boolean;
		selfDestroy?: boolean;
		onReady?: (instance: Vivus) => void;
		callback?: (instance: Vivus) => void;
	}

	export default class Vivus {
		constructor(element: SVGSVGElement, options?: VivusOptions);
		stop(): this;
		destroy(): this;
		play(speed?: number, callback?: (instance: Vivus) => void): this;
		finish(): this;
		reset(): this;
	}
}
