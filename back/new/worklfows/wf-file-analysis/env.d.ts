import type { FileAnalysisInput, FileAnalysisResult } from "./types";

declare global {
	/** Host bridge the RT VM installs (native/runtime/src/prelude.js). */
	const rt: {
		node<T>(name: string, fn: () => T): T;
		get(key: string): unknown;
		set(key: string, value: unknown): void;
		log(message: string): void;
		workflow?: (params: FileAnalysisInput) => FileAnalysisResult;
	};

	/** Execution id the engine injects before the prelude runs. */
	const __execId: string | undefined;
}

export {};
