/* IMPORT */
import { writable } from "../objects/callable";
import ObservableClass from "../objects/observable";
import type { ObservableOptions, Observable } from "../types";

/* INTERFACES */
interface ObservableFunction1 {
	<T>(): Observable<T | undefined>;
}

interface ObservableFunction2 {
	<T>(
		value: undefined,
		options?: ObservableOptions<T | undefined>,
	): Observable<T | undefined>;
}

interface ObservableFunction3<T> {
	(value: T, options?: ObservableOptions<T>): Observable<T>;
}

/* MAIN */
export type ObservableFunction = ObservableFunction1 &
	ObservableFunction2 &
	ObservableFunction3<any>;

const observable: ObservableFunction = <T>(
	value?: T,
	options?: ObservableOptions<T | undefined>,
) => {
	return writable(new ObservableClass(value, options));
};

/* EXPORT */
export default observable;
