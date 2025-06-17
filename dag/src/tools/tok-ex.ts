import {
	countTokensInFile,
	checkContextLimit,
	countTokensInText,
} from "./tokenCounter";

// Пример 1: Подсчет токенов в файле
async function analyzeFile() {
	try {
		const result = await countTokensInFile("./result.md", "gpt-4.1-nano");

		console.log("📊 Анализ файла:");
		console.log(`Файл: ${result.filePath}`);
		console.log(`Модель: ${result.model}`);
		console.log(`Токенов: ${result.tokenCount.toLocaleString()}`);
		console.log(`Символов: ${result.charCount.toLocaleString()}`);
		console.log(`Слов: ${result.wordCount.toLocaleString()}`);
		console.log(`Среднее токенов на слово: ${result.avgTokensPerWord}`);
		console.log(`Примерная стоимость обработки: $${result.estimatedInputCost}`);
		console.log("---");
	} catch (error) {
		console.error("Ошибка:", error);
	}
}

// Запуск всех примеров
async function main() {
	await analyzeFile();
}

// Если файл запускается напрямую
if (import.meta.main) {
	main();
}
