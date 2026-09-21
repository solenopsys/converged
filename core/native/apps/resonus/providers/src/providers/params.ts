/**
 * PARAMS extracts typed values from the user's last message.
 *
 * The request shape is intentionally adapter-owned: the native gateway only
 * forwards the provider request, while this hook keeps PARAMS's format and
 * variants contract out of the generic LLM code.
 */

import { defineProvider } from "../schema.ts";
import { hooks } from "./params.hooks.ts";

export default defineProvider({
	name: "params",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:PARAMS_URL:http://127.0.0.1:8001}",
		headers: {
			"content-type": "application/json",
		},
	},

	decode: {
		always: { emit: "ignore" },
	},

	hooks,
});
