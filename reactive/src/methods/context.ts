/* IMPORT */
import { OWNER } from "../context";
import Context from "../objects/context";
import { isSymbol, noop } from "../utils";
import type { ContextFunction, Contexts } from "../types";

/* INTERFACES */
interface ContextFunctionSymbol {
	<T>(symbol: symbol): T | undefined;
}

interface ContextFunctionContexts {
	<T>(context: Contexts, fn: ContextFunction<T>): T;
}

/* MAIN */
export type ContextFunctionInterface = ContextFunctionSymbol &
	ContextFunctionContexts;

const context: ContextFunctionInterface = <T>(
	symbolOrContext: any,
	fn?: ContextFunction<T>,
) => {
	if (isSymbol(symbolOrContext)) {
		return OWNER.context[symbolOrContext];
	} else {
		return new Context(symbolOrContext).wrap(fn || noop);
	}
};

/* EXPORT */
export default context;
