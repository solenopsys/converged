// Mock rp-notify for workflow tests (test-only, never bundled into a workflow).
// Serves the templates straight from the files `notify template seed` would put
// into the cluster, so a test exercises the wording that actually ships.

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const SHIPPED_DIR = join(import.meta.dir, "../../../modules/commands/mail");

export type MockNotifySend = {
	templateId: string;
	channel: string;
	recipient: string;
	params?: Record<string, unknown>;
	status?: string;
};

export type NotifyMock = {
	templates: Map<string, Record<string, string>>;
	profile: {
		lang: string;
		brand: string;
		supportEmail?: string;
		address?: string;
	};
	sends: MockNotifySend[];
	/** The answer for `notify.*`, or `undefined` when the call is not notify's. */
	handle(key: string, params: any): { value: unknown } | undefined;
};

export function createNotifyMock(): NotifyMock {
	const templates = new Map<string, Record<string, string>>();
	for (const file of readdirSync(SHIPPED_DIR).filter((f) =>
		f.endsWith(".json"),
	)) {
		const letters = JSON.parse(readFileSync(join(SHIPPED_DIR, file), "utf8"));
		const content: Record<string, string> = {};
		for (const [lang, letter] of Object.entries(letters))
			content[lang] = JSON.stringify(letter);
		templates.set(basename(file, ".json"), content);
	}

	const mock: NotifyMock = {
		templates,
		profile: { lang: "en", brand: "Converge" },
		sends: [],
		handle(key, params) {
			switch (key) {
				case "notify.getTemplate": {
					const content = mock.templates.get(params.id);
					return { value: content ? { id: params.id, content } : null };
				}
				case "notify.getProfile":
					return { value: mock.profile };
				case "notify.recordSend":
					mock.sends.push(params.input);
					return { value: `send-${mock.sends.length}` };
				default:
					return undefined;
			}
		},
	};
	return mock;
}
