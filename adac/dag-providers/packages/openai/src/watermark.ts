/**
 * LLM Watermark Cleaner Library
 * Библиотека для обнаружения и удаления скрытых Unicode-символов из текста,
 * генерируемого языковыми моделями (ChatGPT, Claude, Gemini и др.)
 */

/**
 * Тип для результата детекции водяных знаков
 */
export interface WatermarkDetectionResult {
	/** Найдены ли водяные знаки */
	found: boolean;
	/** Список найденных символов с их характеристиками */
	chars: Array<{
		char: string;
		code: string;
		name: string;
		count: number;
	}>;
	/** Общее количество найденных скрытых символов */
	total: number;
	/** Позиции найденных символов в тексте */
	positions: Array<{
		char: string;
		index: number;
	}>;
}

/**
 * Опции для очистки текста
 */
export interface CleaningOptions {
	/** Заменять скрытые символы на обычные пробелы (по умолчанию true) */
	replaceWithSpace?: boolean;
	/** Нормализовать множественные пробелы в одинарные (по умолчанию true) */
	normalizeSpaces?: boolean;
	/** Обрезать пробелы в начале и конце (по умолчанию true) */
	trim?: boolean;
	/** Дополнительные символы для удаления */
	customChars?: string[];
}

/**
 * Карта скрытых Unicode-символов с их описаниями
 */
const HIDDEN_UNICODE_CHARS = new Map([
	["\u202F", "Narrow No-Break Space (NNBSP)"], // Основной в ChatGPT
	["\u00A0", "Non-Breaking Space (NBSP)"],
	["\u200B", "Zero Width Space (ZWSP)"],
	["\u200C", "Zero Width Non-Joiner (ZWNJ)"],
	["\u200D", "Zero Width Joiner (ZWJ)"],
	["\u2060", "Word Joiner (WJ)"],
	["\u2003", "Em Space"],
	["\u2002", "En Space"],
	["\u2009", "Thin Space"],
	["\u200A", "Hair Space"],
	["\u2005", "Four-Per-Em Space"],
	["\u2006", "Six-Per-Em Space"],
	["\u2007", "Figure Space"],
	["\u2008", "Punctuation Space"],
	["\u2014", "Em Dash"], // Иногда используется вместо обычного дефиса
	["\uFEFF", "Zero Width No-Break Space (BOM)"],
	["\u061C", "Arabic Letter Mark"],
	["\u180E", "Mongolian Vowel Separator"],
]);

/**
 * Основная функция для очистки текста от водяных знаков
 * @param text - исходный текст
 * @param options - опции очистки
 * @returns очищенный текст
 */
export function cleanWatermarks(
	text: string,
	options: CleaningOptions = {},
): string {
	if (!text || typeof text !== "string") {
		return text;
	}

	const {
		replaceWithSpace = true,
		normalizeSpaces = true,
		trim = true,
		customChars = [],
	} = options;

	let cleaned = text;
	const allChars = [...HIDDEN_UNICODE_CHARS.keys(), ...customChars];

	// Удаляем/заменяем скрытые символы
	for (const char of allChars) {
		if (replaceWithSpace) {
			cleaned = cleaned.replaceAll(char, " ");
		} else {
			cleaned = cleaned.replaceAll(char, "");
		}
	}

	// Нормализуем пробелы
	if (normalizeSpaces) {
		cleaned = cleaned.replace(/\s+/g, " ");
	}

	// Обрезаем края
	if (trim) {
		cleaned = cleaned.trim();
	}

	return cleaned;
}

/**
 * Детектор водяных знаков в тексте
 * @param text - текст для анализа
 * @returns результат детекции
 */
export function detectWatermarks(text: string): WatermarkDetectionResult {
	if (!text || typeof text !== "string") {
		return {
			found: false,
			chars: [],
			total: 0,
			positions: [],
		};
	}

	const foundChars: Map<string, number> = new Map();
	const positions: Array<{ char: string; index: number }> = [];

	// Ищем каждый символ
	for (const [char, name] of HIDDEN_UNICODE_CHARS) {
		let index = 0;
		let count = 0;

		while ((index = text.indexOf(char, index)) !== -1) {
			count++;
			positions.push({ char, index });
			index++;
		}

		if (count > 0) {
			foundChars.set(char, count);
		}
	}

	// Формируем результат
	const chars = Array.from(foundChars.entries()).map(([char, count]) => ({
		char,
		code: `U+${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")}`,
		name: HIDDEN_UNICODE_CHARS.get(char) || "Unknown",
		count,
	}));

	const total = chars.reduce((sum, item) => sum + item.count, 0);

	return {
		found: total > 0,
		chars,
		total,
		positions: positions.sort((a, b) => a.index - b.index),
	};
}

/**
 * Проверяет, содержит ли текст водяные знаки
 * @param text - текст для проверки
 * @returns true если найдены водяные знаки
 */
export function hasWatermarks(text: string): boolean {
	return detectWatermarks(text).found;
}

/**
 * Получает статистику по тексту
 * @param text - исходный текст
 * @returns объект со статистикой
 */
export function getTextStats(text: string) {
	const detection = detectWatermarks(text);
	const cleaned = cleanWatermarks(text);

	return {
		original: {
			length: text.length,
			lines: text.split("\n").length,
			words: text.split(/\s+/).filter((w) => w.length > 0).length,
		},
		watermarks: {
			found: detection.found,
			total: detection.total,
			types: detection.chars.length,
			chars: detection.chars,
		},
		cleaned: {
			length: cleaned.length,
			lines: cleaned.split("\n").length,
			words: cleaned.split(/\s+/).filter((w) => w.length > 0).length,
			reduction: text.length - cleaned.length,
		},
	};
}

/**
 * Создает визуальное представление позиций водяных знаков
 * @param text - текст
 * @param maxLength - максимальная длина отображаемого текста
 * @returns строка с выделенными позициями
 */
export function visualizeWatermarks(text: string, maxLength = 200): string {
	const detection = detectWatermarks(text);

	if (!detection.found) {
		return text.slice(0, maxLength);
	}

	let result = "";
	let lastIndex = 0;

	for (const pos of detection.positions.slice(0, 50)) {
		// Ограничиваем количество
		if (pos.index >= maxLength) break;

		// Добавляем текст до водяного знака
		result += text.slice(lastIndex, pos.index);

		// Добавляем маркер водяного знака
		const code = pos.char
			.charCodeAt(0)
			.toString(16)
			.toUpperCase()
			.padStart(4, "0");
		result += `[U+${code}]`;

		lastIndex = pos.index + 1;
	}

	// Добавляем оставшийся текст
	result += text.slice(lastIndex, maxLength);

	if (text.length > maxLength) {
		result += "...";
	}

	return result;
}

/**
 * Экспортируем список всех отслеживаемых символов
 */
export const WATERMARK_CHARS = Array.from(HIDDEN_UNICODE_CHARS.keys());

/**
 * Экспортируем карту символов с описаниями
 */
export const WATERMARK_CHARS_MAP = new Map(HIDDEN_UNICODE_CHARS);

/**
 * Утилита для добавления кастомных символов
 * @param char - символ для добавления
 * @param description - описание символа
 */
export function addCustomWatermarkChar(
	char: string,
	description: string,
): void {
	HIDDEN_UNICODE_CHARS.set(char, description);
}

// Экспорт основной функции как дефолтной
export default cleanWatermarks;
