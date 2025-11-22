/* IMPORT */
import { OBSERVER, setObserver } from "../context";
import { isFunction } from "../utils";
import type { FunctionMaybe, UntrackFunction } from "../types";

/* INTERFACES */
interface UntrackFunctionMaybe<T> {
	(fn: FunctionMaybe<T>): T;
}

interface UntrackFunctionInside<T> {
	(fn: UntrackFunction<T>): T;
}

interface UntrackValue<T> {
	(fn: T): T;
}

/* MAIN */
export type UntrackOverloads<T> = UntrackFunctionMaybe<T> &
	UntrackFunctionInside<T> &
	UntrackValue<T>;

const untrackImpl = <T>(fn: UntrackFunction<T> | T): T => {
	if (isFunction(fn)) {
		const observerPrev = OBSERVER;
		if (observerPrev) {
			try {
				setObserver(undefined);
				return fn();
			} finally {
				setObserver(observerPrev);
			}
		} else {
			return fn();
		}
	} else {
		return fn;
	}
};

const untrack: UntrackOverloads<any> = untrackImpl;

/* EXPORT */
export default untrack;
