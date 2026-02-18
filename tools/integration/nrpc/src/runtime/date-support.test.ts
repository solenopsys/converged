// date-support.test.ts
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Elysia } from "elysia";
import { createHttpBackend } from "./http-backend";
import { createHttpClient } from "./http-client";
import type { ServiceMetadata } from "../types";

// Тестовый сервис с Date параметрами
class DateTestService {
  // Метод принимает Date и возвращает его же
  echoDate(date: Date): Date {
    return date;
  }

  // Метод принимает массив дат
  echoDates(dates: Date[]): Date[] {
    return dates;
  }

  // Метод принимает объект с датой
  echoObject(obj: { name: string; createdAt: Date }): {
    name: string;
    createdAt: Date;
  } {
    return obj;
  }

  // Метод возвращает текущую дату
  getCurrentDate(): Date {
    return new Date();
  }

  // Метод с несколькими Date параметрами
  getDateRange(
    start: Date,
    end: Date,
  ): { start: Date; end: Date; days: number } {
    const days = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24),
    );
    return { start, end, days };
  }

  // Async iterable метод возвращающий даты
  async *streamDates(
    count: number,
  ): AsyncIterable<{ index: number; date: Date }> {
    for (let i = 0; i < count; i++) {
      yield { index: i, date: new Date(Date.now() + i * 1000) };
    }
  }
}

// Метаданные сервиса
const serviceMetadata: ServiceMetadata = {
  serviceName: "datetest",
  interfaceName: "DateTestService",
  filePath: "test",
  methods: [
    {
      name: "echoDate",
      parameters: [
        { name: "date", type: "Date", optional: false, isArray: false },
      ],
      returnType: "Date",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "echoDates",
      parameters: [
        { name: "dates", type: "Date", optional: false, isArray: true },
      ],
      returnType: "Date",
      isAsync: true,
      returnTypeIsArray: true,
      isAsyncIterable: false,
    },
    {
      name: "echoObject",
      parameters: [
        {
          name: "obj",
          type: "any",
          optional: false,
          isArray: false,
        },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "getCurrentDate",
      parameters: [],
      returnType: "Date",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "getDateRange",
      parameters: [
        { name: "start", type: "Date", optional: false, isArray: false },
        { name: "end", type: "Date", optional: false, isArray: false },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: false,
    },
    {
      name: "streamDates",
      parameters: [
        { name: "count", type: "number", optional: false, isArray: false },
      ],
      returnType: "any",
      isAsync: true,
      returnTypeIsArray: false,
      isAsyncIterable: true,
    },
  ],
  types: [],
};

describe("Date Type Support", () => {
  let app: Elysia;
  let client: any;
  let server: any;
  const port = 3456;
  const baseUrl = `http://localhost:${port}/services`;

  beforeAll(async () => {
    // Создаем сервер
    app = new Elysia();

    const backend = createHttpBackend({
      metadata: serviceMetadata,
      serviceImpl: DateTestService,
      pathPrefix: "/services", // Добавляем префикс для тестов
    });

    app.use(backend({}));
    app.listen(port);

    // Даем серверу время запуститься
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Создаем клиента
    client = createHttpClient(serviceMetadata, { baseUrl });
  });

  afterAll(() => {
    app.stop();
  });

  test("should serialize and deserialize Date parameter", async () => {
    const testDate = new Date("2024-01-15T10:30:00.000Z");
    const result = await client.echoDate(testDate);

    expect(result).toBeInstanceOf(Date);
    expect(result.toISOString()).toBe(testDate.toISOString());
  });

  test("should handle array of Dates", async () => {
    const dates = [
      new Date("2024-01-01T00:00:00.000Z"),
      new Date("2024-06-15T12:30:00.000Z"),
      new Date("2024-12-31T23:59:59.999Z"),
    ];

    const result = await client.echoDates(dates);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(3);

    result.forEach((date: any, index: number) => {
      expect(date).toBeInstanceOf(Date);
      expect(date.toISOString()).toBe(dates[index].toISOString());
    });
  });

  test("should handle Date in nested object", async () => {
    const obj = {
      name: "Test Object",
      createdAt: new Date("2024-03-20T15:45:00.000Z"),
    };

    const result = await client.echoObject(obj);

    expect(result.name).toBe(obj.name);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.createdAt.toISOString()).toBe(obj.createdAt.toISOString());
  });

  test("should return Date from server", async () => {
    const result = await client.getCurrentDate();

    expect(result).toBeInstanceOf(Date);
    expect(result.getTime()).toBeGreaterThan(Date.now() - 1000);
    expect(result.getTime()).toBeLessThan(Date.now() + 1000);
  });

  test("should handle multiple Date parameters", async () => {
    const start = new Date("2024-01-01T00:00:00.000Z");
    const end = new Date("2024-01-10T00:00:00.000Z");

    const result = await client.getDateRange(start, end);

    expect(result.start).toBeInstanceOf(Date);
    expect(result.end).toBeInstanceOf(Date);
    expect(result.start.toISOString()).toBe(start.toISOString());
    expect(result.end.toISOString()).toBe(end.toISOString());
    expect(result.days).toBe(9);
  });

  test("should handle Date in streaming response", async () => {
    const count = 3;
    const results: any[] = [];

    for await (const item of client.streamDates(count)) {
      results.push(item);
    }

    expect(results).toHaveLength(count);

    results.forEach((item, index) => {
      expect(item.index).toBe(index);
      expect(item.date).toBeInstanceOf(Date);
      expect(item.date.getTime()).toBeGreaterThan(Date.now() - 5000);
    });
  });

  test("should handle null and undefined dates", async () => {
    const result = await client.echoDate(null);
    expect(result).toBeNull();
  });

  test("should preserve Date precision", async () => {
    const testDate = new Date("2024-06-15T14:23:45.678Z");
    const result = await client.echoDate(testDate);

    expect(result.getMilliseconds()).toBe(testDate.getMilliseconds());
    expect(result.getTime()).toBe(testDate.getTime());
  });
});
