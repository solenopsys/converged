/* IMPORT */
import isObservable from "./is_observable";
import { isFunction } from "../utils";
import type { FunctionMaybe, ObservableReadonly } from "../types";

/* INTERFACES */
interface GetFunction1<T> {
	(value: FunctionMaybe<T>, getFunction?: true): T;
}

interface GetFunction2<T> {
	(value: T, getFunction: false): T extends ObservableReadonly<infer U> ? U : T;
}

/* MAIN */
export type GetFunction = GetFunction1<any> & GetFunction2<any>;

const get: GetFunction = <T>(value: any, getFunction: boolean = true): any => {
	const is = getFunction ? isFunction : isObservable;
	if (is(value)) {
		return value();
	} else {
		return value;
	}
};

/* EXPORT */
export default get;
