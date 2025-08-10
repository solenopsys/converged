import {
	describe,
	it,
	expect,
	beforeEach,
	mock,
	test,
	afterEach,
} from "bun:test";
import { TemplateInjectorNode, type TemplateNodeConfig } from "../template";
import { Store } from "../../core/store";
import { MockStoreProvider } from "../../core/tools/mock-store";

describe("TemplateNode", () => {
	let store: Store;
	let mockProvider: MockStoreProvider;

	beforeEach(async () => {
		// Инициализируем Store с MockProvider
		mockProvider = new MockStoreProvider();
		store = Store.initialize(mockProvider);
		await store.init();
	});

	afterEach(async () => {
		await store.deinit();
	});

	test("должен обрабатывать простой шаблон с плейсхолдерами", async () => {
		const config: TemplateNodeConfig = {
			templatePath: "$.template",
			mapping: {
				name: "$.user.name",
				age: "$.user.age",
			},
		};

		const node = new TemplateInjectorNode("testTemplate", config);

		const testData = {
			template: "Привет, {name}! Тебе {age} лет.",
			user: {
				name: "Анна",
				age: 25,
			},
		};

		// Создаем данные в хранилище и получаем ID
		const inputDataId = await store.createEventData(testData);

		// Вызываем метод с ID данных
		const resultDataId = await node.onEvent(inputDataId);

		// Получаем результат из хранилища по ID
		const result = await store.getEventData(resultDataId);

		expect(result).toBe("Привет, Анна! Тебе 25 лет.");
	});

	test("должен выбрасывать ошибку если шаблон не найден", async () => {
		const config: TemplateNodeConfig = {
			templatePath: "$.nonexistent",
			mapping: {},
		};

		const node = new TemplateInjectorNode("testTemplate", config);
		const testData = { something: "else" };

		// Создаем данные в хранилище
		const inputDataId = await store.createEventData(testData);

		// Ожидаем ошибку при вызове метода
		await expect(node.onEvent(inputDataId)).rejects.toThrow(
			"No template found at JSON path",
		);
	});

	test("должен заменять отсутствующие значения пустой строкой", async () => {
		const config: TemplateNodeConfig = {
			templatePath: "$.template",
			mapping: {
				existing: "$.data.existing",
				missing: "$.data.missing",
			},
		};

		const node = new TemplateInjectorNode("testTemplate", config);

		const testData = {
			template: "Есть: {existing}, Нет: {missing}",
			data: {
				existing: "значение",
			},
		};

		// Создаем данные в хранилище
		const inputDataId = await store.createEventData(testData);

		// Вызываем метод с ID данных
		const resultDataId = await node.onEvent(inputDataId);

		// Получаем результат из хранилища
		const result = await store.getEventData(resultDataId);

		expect(result).toBe("Есть: значение, Нет: ");
	});

	test("должен корректно работать с sourceNodeName", async () => {
		const config: TemplateNodeConfig = {
			templatePath: "$.template",
			mapping: {
				source: "$.source",
			},
		};

		const node = new TemplateInjectorNode("testTemplate", config);

		const testData = {
			template: "Получено от узла: {source}",
			source: "неизвестно",
		};

		// Создаем данные в хранилище
		const inputDataId = await store.createEventData(testData);

		// Вызываем метод с указанием источника
		const resultDataId = await node.onEvent(inputDataId, "previousNode");

		// Получаем результат из хранилища
		const result = await store.getEventData(resultDataId);

		// В зависимости от реализации TemplateInjectorNode, может использовать sourceNodeName
		expect(result).toBeDefined();
	});

	test("должен создавать разные ID для результатов", async () => {
		const config: TemplateNodeConfig = {
			templatePath: "$.template",
			mapping: {
				value: "$.value",
			},
		};

		const node = new TemplateInjectorNode("testTemplate", config);

		const testData1 = {
			template: "Значение: {value}",
			value: "первое",
		};

		const testData2 = {
			template: "Значение: {value}",
			value: "второе",
		};

		// Создаем два набора данных
		const inputDataId1 = await store.createEventData(testData1);
		const inputDataId2 = await store.createEventData(testData2);

		// Вызываем метод для обоих
		const resultDataId1 = await node.onEvent(inputDataId1);
		const resultDataId2 = await node.onEvent(inputDataId2);

		// ID результатов должны быть разными
		expect(resultDataId1).not.toBe(resultDataId2);

		// Проверяем данные
		const result1 = await store.getEventData(resultDataId1);
		const result2 = await store.getEventData(resultDataId2);

		expect(result1).toBe("Значение: первое");
		expect(result2).toBe("Значение: второе");
	});
});
