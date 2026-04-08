import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { MarkNode } from ".";
import { Store } from "../../core/store";
import { MockStoreProvider } from "../../core/tools/mock-store";

describe("MarkNode", () => {
	let markNode: MarkNode;
	let store: Store;
	let mockProvider: MockStoreProvider;

	beforeEach(async () => {
		mockProvider = new MockStoreProvider();
		store = Store.initialize(mockProvider);
		await store.init();

		const config = {
			jsonPath: "$.content",
			name: "TestMarkNode",
		};
		markNode = new MarkNode(config.name, config.jsonPath);
	});

	afterEach(async () => {
		await store.deinit();
	});

	describe("constructor", () => {
		it("should create instance with provided config", () => {
			expect(markNode.name).toBe("TestMarkNode");
			expect(markNode).toBeInstanceOf(MarkNode);
		});
	});

	describe("onEvent", () => {
		it("should extract data by JSON path and convert markdown", async () => {
			const data = {
				content: "# Hello World",
			};

			const inputId = await store.createEventData(data);
			const resultId = await markNode.onEvent(inputId);
			const result = await store.getEventData(resultId);

			expect(result).toBeTypeOf("string");
			expect(result).toContain("<h1>Hello World</h1>");
		});

		it("should convert basic markdown elements to HTML", async () => {
			const data = {
				content: "**bold** and *italic*",
			};

			const inputId = await store.createEventData(data);
			const resultId = await markNode.onEvent(inputId);
			const result = await store.getEventData(resultId);

			expect(result).toContain("<strong>bold</strong>");
			expect(result).toContain("<em>italic</em>");
		});

		it("should convert markdown lists to HTML", async () => {
			const data = {
				content: "- item 1\n- item 2",
			};

			const inputId = await store.createEventData(data);
			const resultId = await markNode.onEvent(inputId);
			const result = await store.getEventData(resultId);

			expect(result).toContain("<ul>");
			expect(result).toContain("<li>item 1</li>");
			expect(result).toContain("<li>item 2</li>");
		});

		it("should handle nested JSON paths", async () => {
			const nestedNode = new MarkNode("NestedMarkNode", "$.data.markdown");

			const data = {
				data: {
					markdown: "## Test",
				},
			};

			const inputId = await store.createEventData(data);
			const resultId = await nestedNode.onEvent(inputId);
			const result = await store.getEventData(resultId);
			expect(result).toBeTypeOf("string");
		});

		it("should handle array JSON paths", async () => {
			const arrayNode = new MarkNode("ArrayMarkNode", "$.items[0]");

			const data = {
				items: ["First item", "Second item"],
			};

			const inputId = await store.createEventData(data);
			const resultId = await arrayNode.onEvent(inputId);
			const result = await store.getEventData(resultId);
			expect(result).toBeTypeOf("string");
		});

		it("should throw error when no data found at JSON path", async () => {
			const data = {
				wrongPath: "Some content",
			};

			const inputId = await store.createEventData(data);
			await expect(markNode.onEvent(inputId)).rejects.toThrow(
				"No data found at JSON path: $.content",
			);
		});

		it("should throw error for invalid JSON path", async () => {
			const invalidNode = new MarkNode("InvalidNode", "$[invalid");

			const data = { content: "test" };

			const inputId = await store.createEventData(data);
			await expect(invalidNode.onEvent(inputId)).rejects.toThrow(
				"No data found at JSON path: $[invalid",
			);
		});

		it("should work without context", async () => {
			const data = {
				content: "# No Context Test",
			};

			const inputId = await store.createEventData(data);
			const resultId = await markNode.onEvent(inputId);
			const result = await store.getEventData(resultId);
			expect(result).toBeTypeOf("string");
		});

		it("should handle undefined data parameter", async () => {
			const inputId = await store.createEventData(undefined);
			await expect(markNode.onEvent(inputId)).rejects.toThrow(
				"No data found at JSON path: $.content",
			);
		});

		it("should handle null data parameter", async () => {
			const inputId = await store.createEventData(null);
			await expect(markNode.onEvent(inputId)).rejects.toThrow(
				"No data found at JSON path: $.content",
			);
		});

		it("should return first element when JSONPath returns array", async () => {
			const wildcardNode = new MarkNode("WildcardNode", "$..content");

			const data = {
				nested: {
					content: "First",
				},
				other: {
					content: "Second",
				},
			};

			const inputId = await store.createEventData(data);
			const resultId = await wildcardNode.onEvent(inputId);
			const result = await store.getEventData(resultId);
			expect(result).toBeTypeOf("string");
		});

		it("should handle empty string at JSON path", async () => {
			const data = {
				content: "",
			};

			// Пустая строка - это falsy значение, поэтому выбросится ошибка
			const inputId = await store.createEventData(data);
			await expect(markNode.onEvent(inputId)).rejects.toThrow(
				"No data found at JSON path: $.content",
			);
		});

		it("should handle non-empty string that looks empty", async () => {
			const data = {
				content: " ", // пробел, чтобы не был falsy
			};

			const inputId = await store.createEventData(data);
			const resultId = await markNode.onEvent(inputId);
			const result = await store.getEventData(resultId);
			expect(result).toBeTypeOf("string");
		});
	});
});
