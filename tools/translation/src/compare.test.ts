import { describe, expect, test } from "bun:test";
import { compareJson, compareMarkdown } from "./compare";
import { parseMarkdown } from "./markdown";

const md = (source: string) => parseMarkdown(source);

describe("compareJson structure", () => {
	test("a correct translation differs in text and not in shape", () => {
		const diff = compareJson(
			{ title: "Notification settings", items: ["One", "Two"] },
			{ title: "Настройки уведомлений", items: ["Один", "Два"] },
		);

		expect(diff.missing).toEqual([]);
		expect(diff.extra).toEqual([]);
		expect(diff.typeChanged).toEqual([]);
		expect(diff.sourceHash).toBe(diff.targetHash);
	});

	test("a dropped key is missing", () => {
		const diff = compareJson({ a: "x", b: "y" }, { a: "х" });
		expect(diff.missing).toEqual(["/b"]);
	});

	test("an invented key is extra", () => {
		const diff = compareJson({ a: "x" }, { a: "х", b: "у" });
		expect(diff.extra).toEqual(["/b"]);
	});

	test("a changed node kind is reported with both sides", () => {
		const diff = compareJson({ a: ["x"] }, { a: "х" });
		expect(diff.typeChanged).toEqual([
			{ path: "/a", source: "array", target: "string" },
		]);
	});

	test("key order does not affect the structure hash", () => {
		const left = compareJson({ a: "1", b: "2" }, { a: "1", b: "2" });
		const right = compareJson({ b: "2", a: "1" }, { b: "2", a: "1" });
		expect(left.sourceHash).toBe(right.sourceHash);
	});

	test("a key containing a slash cannot forge another path", () => {
		const diff = compareJson({ "a/b": "x" }, { a: { b: "x" } });
		expect(diff.missing).toEqual(["/a~1b"]);
	});
});

describe("compareJson text", () => {
	test("prose left in the source language is flagged", () => {
		const text = "Choose how you would like to be notified about orders.";
		const diff = compareJson({ note: text }, { note: text }, {}, "ru");

		expect(diff.unchangedStrings).toEqual([
			{ path: "/note", source: text, target: text },
		]);
	});

	test("technical values are not translation misses", () => {
		const diff = compareJson(
			{
				icon: "streamline:bell",
				url: "https://example.com/a",
				id: "hero-main",
			},
			{
				icon: "streamline:bell",
				url: "https://example.com/a",
				id: "hero-main",
			},
			{},
			"ru",
		);
		expect(diff.unchangedStrings).toEqual([]);
	});

	test("short strings pass unless their key says they are prose", () => {
		const diff = compareJson(
			{ label: "Home", unknownKey: "Home" },
			{ label: "Home", unknownKey: "Home" },
			{},
			"ru",
		);
		expect(diff.unchangedStrings.map((item) => item.path)).toEqual(["/label"]);
	});

	test("a loanword kept in the target script is allowed", () => {
		const brand = "Bambu Lab P1S printer integration";
		const diff = compareJson(
			{ note: brand },
			{ note: brand },
			{ sameTextScriptByLocale: { ru: "cyrillic" } },
			"ru",
		);
		// The source is Latin, so it is not "already Cyrillic" and stays flagged.
		expect(diff.unchangedStrings).toHaveLength(1);
	});

	test("ignoreStringPaths silences a known-technical subtree", () => {
		const value = "A sufficiently long technical value to be checked.";
		const diff = compareJson(
			{ diagram: { caption: value } },
			{ diagram: { caption: value } },
			{ ignoreStringPaths: ["/diagram"] },
			"ru",
		);
		expect(diff.unchangedStrings).toEqual([]);
	});

	test("a locale key that still names the source locale is a mismatch", () => {
		const diff = compareJson(
			{ lang: "en" },
			{ lang: "en" },
			{ localeKeys: ["lang"] },
			"ru",
		);
		expect(diff.localeMismatches).toEqual([
			{ path: "/lang", expected: "ru", target: "en" },
		]);
	});
});

describe("compareMarkdown", () => {
	test("a translated document with the same outline is clean", () => {
		const diff = compareMarkdown(
			md(
				"# Notify\n\nSends notifications over channels.\n\n## Setup\n\nAdd a key.\n",
			),
			md(
				"# Уведомления\n\nОтправляет уведомления по каналам.\n\n## Настройка\n\nДобавьте ключ.\n",
			),
			{},
			"ru",
		);

		expect(diff.missing).toEqual([]);
		expect(diff.typeChanged).toEqual([]);
		expect(diff.unchangedStrings).toEqual([]);
		expect(diff.sourceHash).toBe(diff.targetHash);
	});

	test("a dropped section is missing", () => {
		const diff = compareMarkdown(
			md("# One\n\nText.\n\n## Two\n\nMore.\n"),
			md("# Один\n\nТекст.\n"),
		);
		expect(diff.missing).toEqual(["/heading/1"]);
	});

	test("an added section is extra", () => {
		const diff = compareMarkdown(
			md("# One\n\nText.\n"),
			md("# Один\n\nТекст.\n\n## Лишнее\n\nЕщё.\n"),
		);
		expect(diff.extra).toEqual(["/heading/1"]);
	});

	test("a heading demoted to a lower level is a type change", () => {
		const diff = compareMarkdown(
			md("# One\n\nText.\n\n## Two\n\nMore.\n"),
			md("# Один\n\nТекст.\n\n### Два\n\nЕщё.\n"),
		);
		expect(diff.typeChanged).toEqual([
			{ path: "/heading/1", source: "h2", target: "h3" },
		]);
	});

	test("a paragraph left in English is flagged", () => {
		const english = "Sends notifications over channels to the right people.";
		const diff = compareMarkdown(
			md(`# Notify\n\n${english}\n`),
			md(`# Уведомления\n\n${english}\n`),
			{},
			"ru",
		);
		expect(diff.unchangedStrings.map((item) => item.path)).toEqual([
			"/block/1",
		]);
	});

	test("identical fenced code is not a translation miss", () => {
		const code = "```bash\nbun run scan --config ./config.json\n```";
		const diff = compareMarkdown(
			md(`# Run\n\nЗапустите так.\n\n${code}\n`),
			md(`# Запуск\n\nЗапустите вот так вот.\n\n${code}\n`),
			{},
			"ru",
		);
		expect(diff.unchangedStrings).toEqual([]);
	});
});
