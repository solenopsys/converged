import { test, expect, mock, beforeEach } from "bun:test";

// Объявляем моки ГЛОБАЛЬНО, чтобы они были доступны во всех тестах
const mockProviderInvoke = mock(async (method: string, params: any) => {
  console.log(`Mock Provider.invoke: ${method}`);
  console.log(`SQL: ${params.sql}`);
  console.log(`Params: ${JSON.stringify(params.params, null, 2)}`);
  return { success: true };
});

const mockProvider = {
  invoke: mockProviderInvoke,
};

const mockGetOrCreate = mock(async (providerName: string) => {
  console.log(`Mock getOrCreate called with: ${providerName}`);
  return mockProvider;
});

const mockGetProvidersPool = mock(() => ({
  getOrCreate: mockGetOrCreate,
}));

const mockEvaluateJsonPathString = mock((data: any, jsonPath: string): string => {
  const value = (() => {
    switch (jsonPath) {
      case "$.id":
        return data.id;
      case "$.displayName.text":
        return data.displayName?.text;
      case "$.formattedAddress":
        return data.formattedAddress;
      case "$.nationalPhoneNumber":
        return data.nationalPhoneNumber;
      case "$.websiteUri":
        return data.websiteUri;
      case "$.type":
        return data.type || null;
      case "$.location.latitude":
        return data.location?.latitude;
      case "$.location.longitude":
        return data.location?.longitude;
      case "$.score": // для теста нормализации
        return data.score;
      default:
        return null;
    }
  })();

  if (value === null || value === undefined) {
    throw new Error(`Field not found: ${jsonPath}`);
  }

  return String(value);
});

// Мокаем dag-api модуль, используя уже объявленные моки
mock.module("dag-api", () => ({
  evaluateJsonPathString: mockEvaluateJsonPathString,
  getProvidersPool: mockGetProvidersPool,
}));

// Теперь импортируем BulkInsertNode ПОСЛЕ мокирования
import BulkInsertNode from "./index";

// Мок данные
const testData = [
  {
    id: "ChIJ7c6uHqhewokRnrnxaR2B9WY",
    nationalPhoneNumber: "(718) 355-0157",
    formattedAddress: "325 Gold St, Brooklyn, NY 11201, USA",
    location: {
      latitude: 40.694596499999996,
      longitude: -73.9829572,
    },
    websiteUri: "https://www.makelab.com/",
    displayName: {
      text: "Makelab | 3D Printing",
      languageCode: "en",
    },
  },
];

beforeEach(() => {
  // Очищаем историю вызовов моков, но сохраняем сами функции
  mockProviderInvoke.mockClear();
  mockGetOrCreate.mockClear();
  mockGetProvidersPool.mockClear();
  mockEvaluateJsonPathString.mockClear();
});

test("BulkInsertNode should insert single record successfully", async () => {
  // Arrange
  const columnMapping = {
    id: "$.id",
    name: "$.displayName.text",
    address: "$.formattedAddress",
    phone: "$.nationalPhoneNumber",
    website: "$.websiteUri",
    latitude: "$.location.latitude",
    longitude: "$.location.longitude",
  };

  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "geo",
    columnMapping,
    "test-provider",
    false
  );

  // Act
  const result = await bulkInsertNode.execute({array:testData});

  // Assert
  expect(result).toEqual({ inserted: 1 });

  // Проверяем, что функции были вызваны
  expect(mockEvaluateJsonPathString).toHaveBeenCalledTimes(7); // 7 колонок
  expect(mockGetProvidersPool).toHaveBeenCalledTimes(1);
  expect(mockProviderInvoke).toHaveBeenCalledTimes(1);

  // Дополнительно: плейсхолдеры должны быть позиционными ($1, $2, ...)
  const sql = mockProviderInvoke.mock.calls[0][1].sql as string;
  expect(sql).toMatch(/\(\$1,\s*\$2,\s*\$3,\s*\$4,\s*\$5,\s*\$6,\s*\$7\)/);
});

test("BulkInsertNode should handle missing fields gracefully", async () => {
  // Arrange
  const columnMapping = {
    id: "$.id",
    name: "$.displayName.text",
    type: "$.type", // отсутствует
    missing: "$.nonExistentField", // отсутствует
  };

  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "geo",
    columnMapping,
    "test-provider",
    false
  );

  // Act
  const result = await bulkInsertNode.execute({array:testData});

  // Assert
  expect(result).toEqual({ inserted: 1 });
  expect(mockProviderInvoke).toHaveBeenCalledTimes(1);

  // null-ы должны пройти как параметры
  const params = mockProviderInvoke.mock.calls[0][1].params as any[];
  expect(params.length).toBe(4); // 4 колонки
  // Должно быть что-то вроде [<id>, <name>, null, null]
  expect(params[2]).toBeNull();
  expect(params[3]).toBeNull();
});

test("BulkInsertNode should generate correct SQL with ON CONFLICT DO NOTHING", async () => {
  // Arrange
  const columnMapping = {
    id: "$.id",
    name: "$.displayName.text",
  };

  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "geo",
    columnMapping,
    "test-provider",
    false // updateOnConflict = false
  );

  // Act
  await bulkInsertNode.execute({array:testData});

  // Assert
  const call = mockProviderInvoke.mock.calls[0];
  expect(call[0]).toBe("query");
  expect(call[1].sql).toEqual(
    expect.stringContaining("ON CONFLICT DO NOTHING")
  );

  // Также проверим, что идентификаторы квотируются
  expect(call[1].sql).toEqual(expect.stringContaining('INSERT INTO "geo" ("id", "name") VALUES'));
});

test("BulkInsertNode should generate correct SQL with ON CONFLICT DO UPDATE", async () => {
  // Arrange
  const columnMapping = {
    id: "$.id",
    name: "$.displayName.text",
    address: "$.formattedAddress",
  };

  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "geo",
    columnMapping,
    "test-provider",
    true // updateOnConflict = true
  );

  // Act
  await bulkInsertNode.execute({array:testData});

  // Assert
  const call = mockProviderInvoke.mock.calls[0];
  const sql = call[1].sql as string;

  // Проверяем квотирование и форму DO UPDATE
  expect(sql).toEqual(
    expect.stringContaining(
      'ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name", "address" = EXCLUDED."address"'
    )
  );
});

test("BulkInsertNode should handle empty data", async () => {
  // Arrange
  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "geo",
    { id: "$.id" },
    "test-provider",
    false
  );

  // Act
  const result = await bulkInsertNode.execute({array:[]});

  // Assert
  expect(result).toEqual({ inserted: 0 });
  expect(mockGetProvidersPool).not.toHaveBeenCalled();
  expect(mockProviderInvoke).not.toHaveBeenCalled();
});

test("BulkInsertNode should normalize string numbers", async () => {
  // Создаем специальный мок для этого теста
  const testDataWithNumbers = [
    {
      id: "123",
      score: "456.78",
    },
  ];

  const columnMapping = {
    id: "$.id",
    score: "$.score",
  };

  const bulkInsertNode = new BulkInsertNode(
    "test-bulk-insert",
    "test_table",
    columnMapping,
    "test-provider",
    false
  );

  // Act
  const result = await bulkInsertNode.execute({array:testDataWithNumbers});

  // Assert
  expect(result).toEqual({ inserted: 1 });

  // Проверяем, что нормализация работает
  expect(mockProviderInvoke).toHaveBeenCalledTimes(1);
  const invokeCall = mockProviderInvoke.mock.calls[0];

  // второй аргумент — объект { sql, params }
  const passed = invokeCall[1];
  const passedParams = passed.params as any[];

  // id "123" должен быть преобразован в число 123
  expect(passedParams[0]).toBe(123);
  // score остаётся строкой, т.к. содержит точку
  expect(passedParams[1]).toBe("456.78");

  // Дополнительно: placeholders должны быть ($1, $2)
  expect(passed.sql).toMatch(/\(\$1,\s*\$2\)/);
});
