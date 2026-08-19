// serialization.test.ts - Unit tests for serialization functions
import { describe, test, expect } from "bun:test";
import { serializeValue, deserializeValue } from "./serialization";

describe("serializeValue", () => {
  test("should serialize Date to ISO string", () => {
    const date = new Date("2024-01-15T10:30:00.000Z");
    const result = serializeValue(date);
    expect(result).toBe("2024-01-15T10:30:00.000Z");
  });

  test("should serialize array of Dates", () => {
    const dates = [
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-06-15T12:30:00.000Z"),
    ];
    const result = serializeValue(dates);
    expect(result).toEqual([
      "2024-01-01T00:00:00.000Z",
      "2024-06-15T12:30:00.000Z",
    ]);
  });

  test("should serialize Date in nested object", () => {
    const obj = {
      name: "Test",
      createdAt: new Date("2024-03-20T15:45:00.000Z"),
      metadata: {
        updatedAt: new Date("2024-03-21T10:00:00.000Z"),
      },
    };
    const result = serializeValue(obj);
    expect(result).toEqual({
      name: "Test",
      createdAt: "2024-03-20T15:45:00.000Z",
      metadata: {
        updatedAt: "2024-03-21T10:00:00.000Z",
      },
    });
  });

  test("should handle null and undefined", () => {
    expect(serializeValue(null)).toBeNull();
    expect(serializeValue(undefined)).toBeUndefined();
  });

  test("should preserve non-Date values", () => {
    expect(serializeValue("string")).toBe("string");
    expect(serializeValue(123)).toBe(123);
    expect(serializeValue(true)).toBe(true);
    expect(serializeValue({ a: 1, b: "test" })).toEqual({ a: 1, b: "test" });
  });
});

describe("deserializeValue", () => {
  test("should deserialize ISO string to Date when type is Date", () => {
    const result = deserializeValue("2024-01-15T10:30:00.000Z", "Date");
    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe("2024-01-15T10:30:00.000Z");
  });

  test("should deserialize array of ISO strings to Dates", () => {
    const result = deserializeValue(
      ["2024-01-01T00:00:00.000Z", "2024-06-15T12:30:00.000Z"],
      "Date",
    );
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]).toBeInstanceOf(Date);
    expect(result[1]).toBeInstanceOf(Date);
    expect(result[0].toISOString()).toBe("2024-01-01T00:00:00.000Z");
    expect(result[1].toISOString()).toBe("2024-06-15T12:30:00.000Z");
  });

  test("should auto-detect ISO strings in objects", () => {
    const obj = {
      name: "Test",
      createdAt: "2024-03-20T15:45:00.000Z",
      count: 42,
    };
    const result = deserializeValue(obj);
    expect(result.name).toBe("Test");
    expect(result.count).toBe(42);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe("2024-03-20T15:45:00.000Z");
  });

  test("should auto-detect ISO strings in nested objects", () => {
    const obj = {
      data: {
        timestamp: "2024-03-20T15:45:00.000Z",
      },
    };
    const result = deserializeValue(obj);
    expect(result.data.timestamp).toBeInstanceOf(Date);
  });

  test("should handle null and undefined", () => {
    expect(deserializeValue(null)).toBeNull();
    expect(deserializeValue(undefined)).toBeUndefined();
  });

  test("should preserve non-Date values", () => {
    expect(deserializeValue("string")).toBe("string");
    expect(deserializeValue(123)).toBe(123);
    expect(deserializeValue(true)).toBe(true);
  });

  test("should not convert non-ISO strings", () => {
    const obj = { text: "hello world", number: "123" };
    const result = deserializeValue(obj);
    expect(result.text).toBe("hello world");
    expect(result.number).toBe("123");
  });

  test("should preserve Date precision", () => {
    const original = "2024-06-15T14:23:45.678Z";
    const result = deserializeValue(original, "Date");
    expect(result.getMilliseconds()).toBe(678);
    expect(result.toISOString()).toBe(original);
  });
});

describe("Round-trip serialization", () => {
  test("should maintain Date through serialize -> deserialize", () => {
    const original = new Date("2024-01-15T10:30:00.000Z");
    const serialized = serializeValue(original);
    const deserialized = deserializeValue(serialized, "Date");

    expect(deserialized).toBeInstanceOf(Date);
    expect(deserialized.getTime()).toBe(original.getTime());
  });

  test("should maintain complex object with Dates", () => {
    const original = {
      id: 123,
      name: "Test",
      createdAt: new Date("2024-01-15T10:30:00.000Z"),
      tags: ["a", "b"],
      metadata: {
        updatedAt: new Date("2024-01-16T12:00:00.000Z"),
      },
    };

    const serialized = serializeValue(original);
    const deserialized = deserializeValue(serialized);

    expect(deserialized.id).toBe(original.id);
    expect(deserialized.name).toBe(original.name);
    expect(deserialized.createdAt).toBeInstanceOf(Date);
    expect(deserialized.createdAt.getTime()).toBe(original.createdAt.getTime());
    expect(deserialized.metadata.updatedAt).toBeInstanceOf(Date);
    expect(deserialized.metadata.updatedAt.getTime()).toBe(
      original.metadata.updatedAt.getTime(),
    );
  });
});
