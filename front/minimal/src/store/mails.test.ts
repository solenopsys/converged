import { describe, test, expect, beforeEach, mock } from "bun:test";
import { fork, allSettled } from "effector";

// Mock the API client
const mockListWarmMails = mock(() => Promise.resolve({
  items: Array.from({ length: 30 }, (_, i) => ({
    id: i,
    subject: `Mail ${i}`,
    sender: `sender${i}@test.com`,
    recipient: `recipient${i}@test.com`,
    date: new Date().toISOString()
  }))
}));

// Mock generated module
mock.module("../generated", () => ({
  mailingClient: {
    listWarmMails: mockListWarmMails
  }
}));

// Import after mocking
const {
  mailsData,
  loadMore,
  tableReady,
  loadMailsFx,
  $offset,
  $isLoading,
  $tableApi
} = await import("./mails");

describe("Mails Store", () => {
  beforeEach(() => {
    // Clear mailsData before each test
    mailsData.length = 0;
    mockListWarmMails.mockClear();
  });

  test("loadMailsFx should fetch data and push to mailsData", async () => {
    const scope = fork();

    await allSettled(loadMailsFx, { scope, params: 0 });

    expect(mailsData.length).toBe(30);
    expect(mailsData[0]).toHaveProperty("id", 0);
    expect(mailsData[0]).toHaveProperty("subject", "Mail 0");
  });

  test("loadMailsFx should update $offset", async () => {
    const scope = fork();

    expect(scope.getState($offset)).toBe(0);

    await allSettled(loadMailsFx, { scope, params: 0 });

    expect(scope.getState($offset)).toBe(30);
  });

  test("$isLoading should be true during fetch", async () => {
    const scope = fork();

    expect(scope.getState($isLoading)).toBe(false);

    const promise = allSettled(loadMailsFx, { scope, params: 0 });

    // During fetch
    expect(scope.getState($isLoading)).toBe(true);

    await promise;

    expect(scope.getState($isLoading)).toBe(false);
  });

  test("loadMore should trigger loadMailsFx with current offset", async () => {
    const scope = fork({
      values: [
        [$offset, 30],
        [$isLoading, false]
      ]
    });

    await allSettled(loadMore, { scope });

    expect(mockListWarmMails).toHaveBeenCalledWith({
      offset: 30,
      limit: 30
    });
  });

  test("loadMore should not trigger when isLoading is true", async () => {
    const scope = fork({
      values: [
        [$offset, 0],
        [$isLoading, true]
      ]
    });

    await allSettled(loadMore, { scope });

    // Should not be called because isLoading is true
    expect(mockListWarmMails).not.toHaveBeenCalled();
  });

  test("tableReady should store API reference", async () => {
    const scope = fork();
    const mockApi = { updateData: mock(() => {}) };

    await allSettled(tableReady, { scope, params: mockApi });

    expect(scope.getState($tableApi)).toBe(mockApi);
  });

  test("loadMailsFx.done should call tableApi.updateData", async () => {
    const mockUpdateData = mock(() => {});
    const mockApi = { updateData: mockUpdateData };

    const scope = fork({
      values: [
        [$tableApi, mockApi]
      ]
    });

    await allSettled(loadMailsFx, { scope, params: 0 });

    expect(mockUpdateData).toHaveBeenCalled();
  });

  test("multiple loadMore calls should accumulate data", async () => {
    const scope = fork();

    // First load
    await allSettled(loadMailsFx, { scope, params: 0 });
    expect(mailsData.length).toBe(30);
    expect(scope.getState($offset)).toBe(30);

    // Second load
    await allSettled(loadMailsFx, { scope, params: 30 });
    expect(mailsData.length).toBe(60);
    expect(scope.getState($offset)).toBe(60);
  });
});
