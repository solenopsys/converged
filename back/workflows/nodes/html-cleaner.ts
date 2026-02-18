import { type INode } from "../dag-api";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

export class HtmlCleanNode implements INode {
	public scope!: string;

	constructor(public name: string) {}

	async execute(data: any): Promise<any> {
		const document = normalizeDocument(data);
		return new Readability(document).parse();
	}
}

function normalizeDocument(data: any): Document {
	if (data?.nodeType === 9) {
		return data;
	}

	if (typeof data === "string") {
		return new JSDOM(data).window.document;
	}

	if (data?.html && typeof data.html === "string") {
		return new JSDOM(data.html).window.document;
	}

	return new JSDOM(String(data ?? "")).window.document;
}

function cleanHtml(html: string): string {
	// Создаем DOM из HTML строки
	const dom = new JSDOM(html);
	const document = dom.window.document;

	// Передаем document в Readability
	const reader = new Readability(document);
	const article = reader.parse();

	if (!article?.content) return "";

	// Конфигурируем TurndownService с удалением изображений
	const turndownService = new TurndownService({
		headingStyle: "atx",
		bulletListMarker: "-",
		codeBlockStyle: "fenced",
	});

	// Удаляем все изображения
	turndownService.addRule("removeImages", {
		filter: ["img"],
		replacement: () => "",
	});

	return turndownService.turndown(article.content);
}

function removeImagesFromMarkdown(markdown: string): string {
	// Удаляем все изображения в формате ![alt](url)
	return (
		markdown
			.replace(/!\[.*?\]\(.*?\)/g, "")
			// Удаляем пустые строки, которые остались после удаления изображений
			.replace(/\n\s*\n\s*\n/g, "\n\n")
			// Убираем лишние пробелы в начале строк
			.replace(/^\s+$/gm, "")
			.trim()
	);
}
