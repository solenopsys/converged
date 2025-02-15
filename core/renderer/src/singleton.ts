/* IMPORT */

import isServer from "./methods/is_server";

/* MAIN */

if (!isServer()) {
	const isLoaded = !!globalThis.CONVERGED;

	if (isLoaded) {
		throw new Error("Renderer has already been loaded");
	} else {
		globalThis.CONVERGED = true;
	}
}
