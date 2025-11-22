/* IMPORT */
import memo from "./memo";
import { frozen } from "../objects/callable";
import {
	SYMBOL_OBSERVABLE,
	SYMBOL_UNTRACKED,
	SYMBOL_UNTRACKED_UNWRAPPED,
} from "../symbols";
import { isFunction } from "../utils";
import type { Resolvable, Resolved } from "../types";

/* INTERFACES */
export interface ResolveFunction<T> {
	(value: T): T extends Resolvable ? Resolved<T> : never;
}

interface ResolveImplementation {
	<T>(value: T): any;
}

/* MAIN */
const resolveImpl: ResolveImplementation = <T>(value: T): any => {
	if (isFunction(value)) {
		if (SYMBOL_UNTRACKED_UNWRAPPED in value) {
			return resolveImpl(value());
		} else if (SYMBOL_UNTRACKED in value) {
			return frozen(resolveImpl(value()));
		} else if (SYMBOL_OBSERVABLE in value) {
			return value;
		} else {
			return memo(() => resolveImpl(value()));
		}
	}

	if (value instanceof Array) {
		const resolved = new Array(value.length);
		for (let i = 0, l = resolved.length; i < l; i++) {
			resolved[i] = resolveImpl(value[i]);
		}
		return resolved;
	} else {
		return value;
	}
};

const resolve: ResolveFunction<any> = resolveImpl;

/* EXPORT */
export default resolve;
