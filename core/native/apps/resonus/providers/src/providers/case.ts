import { defineProvider } from "../schema.ts";
import { hooks } from "./case.hooks.ts";

export default defineProvider({
	name: "case",

	transport: {
		kind: "https",
		stateful: false,
		url: "${env:CASE_URL:http://127.0.0.1:8000}",
		headers: {
			"content-type": "application/json",
		},
	},

	decode: {
		always: { emit: "ignore" },
	},

	hooks,
});
