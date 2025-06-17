import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import TurndownService from "turndown";

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

// Правильно читаем файл как текст
const fileData = await Bun.file("./test.html").text();
const markdownResult = cleanHtml(fileData);

// Удаляем изображения из markdown
const cleanMarkdown = removeImagesFromMarkdown(markdownResult);

console.log(cleanMarkdown);

// Сохраняем результат в файл
await Bun.write("./result.md", cleanMarkdown);
