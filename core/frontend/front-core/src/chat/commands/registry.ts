import { createDomain } from "effector";
import type { SlashSection } from "./types";

const domain = createDomain("chat-commands");
const sectionRegistered = domain.createEvent<SlashSection>();

export const $slashSections = domain
	.createStore<SlashSection[]>([])
	.on(sectionRegistered, (sections, section) =>
		[...sections.filter(({ name }) => name !== section.name), section].sort(
			(a, b) => a.name.localeCompare(b.name),
		),
	);

export function registerSlashSection(section: SlashSection): void {
	sectionRegistered(section);
}

export function slashSections(): SlashSection[] {
	return $slashSections.getState();
}

export function isSlashInput(text: string): boolean {
	return text.trimStart().startsWith("/");
}

const table = (
	rows: Array<[string, string]>,
	header: [string, string],
): string => {
	const width = Math.max(
		...rows.map(([left]) => left.length),
		header[0].length,
	);
	const line = (left: string, right: string) =>
		`${left.padEnd(width)}  ${right}`;
	return [
		"```",
		line(...header),
		line("─".repeat(width), "─".repeat(40)),
		...rows.map(([left, right]) => line(left, right)),
		"```",
	].join("\n");
};

function sectionHelp(section: SlashSection): string {
	const commands = Object.entries(section.commands ?? {});
	if (commands.length === 0)
		return `**/${section.name}** — ${section.description}`;
	return [
		`**/${section.name}** — ${section.description}`,
		table(
			commands.map(([name, command]) => [name, command.description]),
			["command", "description"],
		),
	].join("\n\n");
}

function help(): string {
	const all = slashSections();
	if (all.length === 0) return "No slash commands are registered.";
	return [
		"**Available commands** - `/<section> [command] [parameter]`",
		table(
			all.map((section) => [`/${section.name}`, section.description]),
			["section", "description"],
		),
	].join("\n\n");
}

function editDistance(left: string, right: string): number {
	const previous = Array.from(
		{ length: right.length + 1 },
		(_, index) => index,
	);
	for (let row = 1; row <= left.length; row += 1) {
		const current = [row];
		for (let column = 1; column <= right.length; column += 1) {
			current[column] = Math.min(
				current[column - 1]! + 1,
				previous[column]! + 1,
				previous[column - 1]! + (left[row - 1] === right[column - 1] ? 0 : 1),
			);
		}
		previous.splice(0, previous.length, ...current);
	}
	return previous[right.length] ?? Math.max(left.length, right.length);
}

function closestSection(name: string): string | undefined {
	let closest: { name: string; distance: number } | undefined;
	for (const section of slashSections()) {
		const distance = editDistance(name, section.name);
		if (!closest || distance < closest.distance) {
			closest = { name: section.name, distance };
		}
	}
	return closest && closest.distance <= 2 ? closest.name : undefined;
}

export async function runSlashCommand(input: string): Promise<string> {
	const [head, command, ...rest] = input.trim().slice(1).split(/\s+/);
	const param = rest.length > 0 ? rest.join(" ") : undefined;

	if (!head || head === "help") return help();

	const section = slashSections().find(({ name }) => name === head);
	if (!section) {
		const suggestion = closestSection(head);
		return [
			`Unknown command: \`/${head}\`.`,
			suggestion ? `Did you mean \`/${suggestion}\`?` : "",
			help(),
		]
			.filter(Boolean)
			.join("\n\n");
	}

	const entry = command ? section.commands?.[command] : undefined;
	try {
		if (entry) return await entry.handler(param);
		if (section.fallback) {
			return await section.fallback(
				[command, param].filter(Boolean).join(" ") || undefined,
			);
		}
		if (command) {
			return [
				`Unknown command: \`/${head} ${command}\`.`,
				"",
				sectionHelp(section),
			].join("\n");
		}
		return sectionHelp(section);
	} catch (error) {
		return `Error in \`/${head}${command ? ` ${command}` : ""}\`: ${
			error instanceof Error ? error.message : String(error)
		}`;
	}
}
