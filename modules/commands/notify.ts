// Letters are files. This command is the only thing that puts them into the
// cluster: it reads the templates from ./mail and hands them to rp-notify, where
// every sender — the UI gateway's magic link and the workflows — reads them.
//
// Same lesson the presets paid for (`access preset seed`): a letter that lived
// only in the cluster's data would be missing on the next clean install, and a
// missing letter there is a sign-in that cannot be sent. So: edit a file, run
// `notify template seed`, and the wording has changed everywhere.
//
// The profile is the other half — the company language every letter falls back
// to, and the brand, support address and postal line the layout prints.

import {
	BaseCommandProcessor,
	type CommandEntry,
	type Handler,
} from "dag-cli/base";
import { createCliNrpcClientConfig } from "dag-cli/ws";
import {
	MAIL_LANGS,
	type MailContent,
	type MailTemplate,
	parseMailContent,
	renderMail,
} from "dag-mail";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import {
	createNotifyServiceClient,
	type NotifyProfilePatch,
	type NotifyServiceClient,
} from "g-notify/browser";
import { basename, join, resolve } from "path";

const MAIL_DIR = join(import.meta.dir, "mail");

function shippedTemplates(): string[] {
	try {
		return readdirSync(MAIL_DIR)
			.filter((file: string) => file.endsWith(".json"))
			.map((file: string) => basename(file, ".json"))
			.sort();
	} catch {
		return [];
	}
}

/**
 * A file, checked the way a sender will use it: every language must parse and
 * render. A template that fails here would fail later in somebody's sign-in.
 */
function readTemplateFile(target: string): {
	id: string;
	content: Record<string, string>;
} {
	const path =
		target.includes("/") || target.endsWith(".json")
			? resolve(target)
			: join(MAIL_DIR, `${target}.json`);
	let parsed: Record<string, MailContent>;
	try {
		parsed = JSON.parse(readFileSync(path, "utf8"));
	} catch (error: any) {
		throw new Error(
			`${path}: ${error?.code === "ENOENT" ? "no such template file" : (error?.message ?? error)}`,
		);
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		throw new Error(`${path} must map a language to a letter`);
	}
	const id = basename(path, ".json");
	const content: Record<string, string> = {};
	for (const [lang, letter] of Object.entries(parsed)) {
		parseMailContent(id, lang, letter);
		content[lang] = JSON.stringify(letter);
	}
	renderMail({ id, content }, "en", {});
	return { id, content };
}

function missingLangs(content: Record<string, unknown>): string[] {
	return MAIL_LANGS.filter((lang) => !(lang in content));
}

function requireParam(param: string | undefined, usage: string): string[] {
	const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) throw new Error(`Usage: ${usage}`);
	return parts;
}

// ---- templates --------------------------------------------------------------

const listHandler: Handler = async (client: NotifyServiceClient) => {
	const stored = await client.listTemplates();
	const onDisk = new Set(shippedTemplates());
	const known = new Set([...stored.map((tpl) => tpl.id), ...onDisk]);

	console.log("Mail templates");
	console.log("--------------");
	for (const id of [...known].sort()) {
		const live = stored.find((tpl) => tpl.id === id);
		const langs = live ? Object.keys(live.content) : [];
		// Not seeded is the failure this listing exists to make visible: it is
		// what a user sees as "the link never came".
		const state = !live
			? "file only, NOT SEEDED"
			: langs.length === 0
				? "SEEDED EMPTY"
				: `${langs.join(",")}${missingLangs(live.content).length ? `  (missing ${missingLangs(live.content).join(",")})` : ""}`;
		const source = onDisk.has(id) ? "" : "  (no file in ./mail)";
		console.log(`  ${id.padEnd(24)} ${state}${source}`);
	}
};

const setHandler: Handler = async (
	client: NotifyServiceClient,
	_splitter,
	param,
) => {
	const [target] = requireParam(param, "notify template set <id|path/to.json>");
	const template = readTemplateFile(target);
	await client.saveTemplate(template);
	console.log(
		`Wrote template "${template.id}" (${Object.keys(template.content).join(",")})`,
	);
};

const seedHandler: Handler = async (client: NotifyServiceClient) => {
	const ids = shippedTemplates();
	if (ids.length === 0) throw new Error(`No template files in ${MAIL_DIR}`);
	// Everything is read and checked before anything is written, so a broken
	// file does not leave the cluster with half of the letters updated.
	const templates = ids.map((id) => readTemplateFile(id));
	for (const template of templates) {
		await client.saveTemplate(template);
		const missing = missingLangs(template.content);
		console.log(
			`  ${template.id.padEnd(24)} ${Object.keys(template.content).length} languages` +
				(missing.length ? `  (missing ${missing.join(",")})` : ""),
		);
	}
	console.log(`Seeded ${templates.length} templates from ${MAIL_DIR}`);
};

/**
 * Render a stored template with the live profile and placeholder values, so a
 * wording change can be looked at before a customer does.
 */
const previewHandler: Handler = async (
	client: NotifyServiceClient,
	_splitter,
	param,
) => {
	const [id, lang = "en", out] = requireParam(
		param,
		"notify template preview <id> [lang] [out.html]",
	);
	const live = await client.getTemplate(id);
	const template: MailTemplate = live ?? readTemplateFile(id);
	if (!live)
		console.log(`(${id} is not seeded — previewing ./mail/${id}.json)`);
	const profile = await client.getProfile();

	// Every `{{name}}` the template mentions gets a visible stand-in.
	const names = new Set<string>();
	for (const value of Object.values(template.content)) {
		for (const match of String(
			typeof value === "string" ? value : JSON.stringify(value),
		).matchAll(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g)) {
			names.add(match[1]);
		}
	}
	const vars: Record<string, string> = {};
	for (const name of names) vars[name] = `<${name}>`;
	for (const name of names)
		if (/url$/i.test(name)) vars[name] = `https://example.test/${name}`;
	Object.assign(vars, {
		brand: profile.brand,
		supportEmail: profile.supportEmail ?? "",
		address: profile.address ?? "",
	});

	const mail = renderMail(template, lang, vars);
	console.log(`[${mail.lang}] ${mail.subject}\n`);
	console.log(mail.text);
	if (out) {
		writeFileSync(resolve(out), mail.html);
		console.log(`\nhtml → ${resolve(out)}`);
	}
};

const templateRouter: Handler = async (client, splitter, param) => {
	const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
	const sub = parts.shift() ?? "list";
	const rest = parts.join(" ");
	const routes: Record<string, Handler> = {
		list: listHandler,
		set: setHandler,
		seed: seedHandler,
		preview: previewHandler,
	};
	const handler = routes[sub];
	if (!handler) {
		throw new Error(
			`Unknown subcommand "${sub}". Try: ${Object.keys(routes).join(" | ")}`,
		);
	}
	await handler(client, splitter, rest);
};

// ---- profile ----------------------------------------------------------------

const PROFILE_KEYS = ["lang", "brand", "supportEmail", "address"] as const;

/**
 * `key=value` pairs. The CLI hands the arguments over already joined by spaces
 * with the shell's quotes gone, so a value runs until the next `field=`:
 * `brand=Acme Works address=1 Example St` is two fields.
 */
function parseAssignments(text: string): NotifyProfilePatch {
	const patch: Record<string, string> = {};
	const fields = PROFILE_KEYS.join("|");
	const re = new RegExp(
		`(?:^|\\s)(${fields})=(.*?)(?=\\s+(?:${fields})=|$)`,
		"g",
	);
	for (const match of text.trim().matchAll(re)) {
		patch[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
	}
	if (Object.keys(patch).length === 0) {
		throw new Error(
			`Usage: notify profile set lang=ru brand=Acme Works supportEmail=help@acme.test address=… (fields: ${PROFILE_KEYS.join(", ")})`,
		);
	}
	return patch;
}

const profileRouter: Handler = async (
	client: NotifyServiceClient,
	_splitter,
	param,
) => {
	const text = (param ?? "").trim();
	const sub = text.split(/\s+/)[0] || "show";
	if (sub === "set") {
		const saved = await client.saveProfile(parseAssignments(text.slice(3)));
		console.log("Saved.");
		printProfile(saved);
		return;
	}
	if (sub !== "show")
		throw new Error(`Unknown subcommand "${sub}". Try: show | set`);
	printProfile(await client.getProfile());
};

function printProfile(profile: Record<string, unknown>): void {
	for (const key of [...PROFILE_KEYS, "updatedAt"]) {
		console.log(`  ${key.padEnd(13)} ${profile[key] ?? "-"}`);
	}
}

class NotifyProcessor extends BaseCommandProcessor {
	protected initializeCommandMap(): Map<string, CommandEntry> {
		return new Map([
			[
				"template",
				{
					handler: templateRouter,
					description:
						"Letters as files: notify template list | set <id|path> | seed | preview <id> [lang] [out.html]",
				},
			],
			[
				"profile",
				{
					handler: profileRouter,
					description:
						'Company language and letterhead: notify profile show | set lang=ru brand="Acme"',
				},
			],
		]);
	}
}

export default () => {
	const client: NotifyServiceClient = createNotifyServiceClient(
		createCliNrpcClientConfig(),
	);
	return new NotifyProcessor(client);
};
