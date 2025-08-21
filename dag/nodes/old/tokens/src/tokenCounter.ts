import { encoding_for_model } from "tiktoken";

/**
 * Подсчитывает количество токенов в файле для выбранной модели OpenAI
 * и оценивает стоимость ввода.
 *
 * @param filePath – путь к файлу
 * @param model    – модель ('gpt-4o' | 'gpt-4.1-nano'), по умолчанию 'gpt-4o'
 */
export async function countTokensInFile(
	filePath: string,
	model: "gpt-4o" | "gpt-4.1-nano" = "gpt-4o",
) {
	try {
		// 1. Читаем файл
		const fileContent = await Bun.file(filePath).text();

		// 2. Энкодер и подсчёт токенов
		const encoder = encoding_for_model(model);
		const tokenCount = encoder.encode(fileContent).length;
		encoder.free(); // освобождаем WASM-память

		// 3. Стоимость
		const pricing = getPricing(model);
		const inputCost = (tokenCount / 1_000) * pricing.input;

		// 4. Доп. статистика
		const charCount = fileContent.length;
		const words = fileContent.trim().split(/\s+/);
		const wordCount = words.filter(Boolean).length;
		const avgTokensPerWord = wordCount ? tokenCount / wordCount : 0;

		return {
			filePath,
			model,
			tokenCount,
			charCount,
			wordCount,
			avgTokensPerWord: Number(avgTokensPerWord.toFixed(2)),
			estimatedInputCost: Number(inputCost.toFixed(4)),
			pricing, // { inputPer1K, outputPer1K }
		};
	} catch (err) {
		throw new Error(`Ошибка при подсчёте токенов: ${err}`);
	}
}

/**
 * Актуальные цены (USD за 1 000 токенов, июнь 2025)
 */
function getPricing(model: string) {
	const prices: Record<string, { input: number; output: number }> = {
		// GPT-4o: 2,50 $ за 1 М входа и 10,00 $ за 1 М выхода
		"gpt-4o": { input: 0.0025, output: 0.01 }, // :contentReference[oaicite:0]{index=0}

		// GPT-4.1 nano: 0,10 $ за 1 М входа и 0,40 $ за 1 М выхода
		"gpt-4.1-nano": { input: 0.0001, output: 0.0004 }, // :contentReference[oaicite:1]{index=1}
	};

	return prices[model] ?? prices["gpt-4o"];
}
