import { test, expect, beforeEach, afterEach, describe } from "bun:test";
import { RandomStringNode } from "../random";
import { Store } from "../../core/store";
import { MockStoreProvider } from "../../core/tools/mock-store";

describe("RandomStringNode", () => {
	let store: Store;
	let mockProvider: MockStoreProvider;

	beforeEach(async () => {
		mockProvider = new MockStoreProvider();
		store = Store.initialize(mockProvider);
		await store.init();
	});

	afterEach(async () => {
		await store.deinit();
	});

	test("generates string with default length", async () => {
		const generator = new RandomStringNode("test");

		// Создаем пустые входные данные
		const inputId = await store.createEventData({});

		// Генерируем строку
		const resultId = await generator.onEvent(inputId);

		// Получаем результат из хранилища
		const result = await store.getEventData(resultId);

		expect(result).toHaveLength(10);
		expect(typeof result).toBe("string");
	});

	test("generates string with custom length", async () => {
		const generator = new RandomStringNode("test", 5);

		const inputId = await store.createEventData({});
		const resultId = await generator.onEvent(inputId);
		const result = await store.getEventData(resultId);

		expect(result).toHaveLength(5);
	});

	test("uses only specified charset", async () => {
		const generator = new RandomStringNode("test", 20, "ABC");

		const inputId = await store.createEventData({});
		const resultId = await generator.onEvent(inputId);
		const result = await store.getEventData(resultId);

		expect(result).toMatch(/^[ABC]+$/);
		expect(result).toHaveLength(20);
	});

	test("does not preserve input data - returns only string", async () => {
		const generator = new RandomStringNode("test");
		const input = { existing: "data", otherField: 123 };

		const inputId = await store.createEventData(input);
		const resultId = await generator.onEvent(inputId);
		const result = await store.getEventData(resultId);

		// RandomStringNode returns only the string, not an object
		expect(typeof result).toBe("string");
		expect(result).toHaveLength(10);
	});

	test("generates different strings", async () => {
		const generator = new RandomStringNode("test");

		// Первая генерация
		const inputId1 = await store.createEventData({});
		const resultId1 = await generator.onEvent(inputId1);
		const result1 = await store.getEventData(resultId1);

		// Вторая генерация
		const inputId2 = await store.createEventData({});
		const resultId2 = await generator.onEvent(inputId2);
		const result2 = await store.getEventData(resultId2);

		expect(result1).not.toBe(result2);
	});

	test("creates new data entries for each generation", async () => {
		const generator = new RandomStringNode("test");
		const input = { baseData: "test" };

		const inputId = await store.createEventData(input);

		// Генерируем несколько раз с одними и теми же входными данными
		const resultId1 = await generator.onEvent(inputId);
		const resultId2 = await generator.onEvent(inputId);
		const resultId3 = await generator.onEvent(inputId);

		// Все ID должны быть разными
		expect(resultId1).not.toBe(inputId);
		expect(resultId2).not.toBe(inputId);
		expect(resultId3).not.toBe(inputId);
		expect(resultId1).not.toBe(resultId2);
		expect(resultId2).not.toBe(resultId3);

		// Но исходные данные не должны измениться
		const originalData = await store.getEventData(inputId);
		expect(originalData).toEqual(input);

		// А каждый результат должен содержать разные строки
		const result1 = await store.getEventData(resultId1);
		const result2 = await store.getEventData(resultId2);
		const result3 = await store.getEventData(resultId3);

		expect(result1).not.toBe(result2);
		expect(result2).not.toBe(result3);
	});
});
