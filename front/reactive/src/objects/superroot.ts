/* IMPORT */

import Owner from "./owner";
import type { Contexts } from "../types";

/* MAIN */

class SuperRoot extends Owner {
	/* VARIABLES */

	declare parent: undefined;
	context: Contexts = {};
}

/* EXPORT */

export default SuperRoot;
