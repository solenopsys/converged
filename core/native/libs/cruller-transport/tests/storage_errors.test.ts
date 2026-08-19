import { expect, test } from "bun:test";
import { parseStorageErrorText, StorageErrorCodes } from "../src/storage-errors";

test("coded storage errors are split into code and detail", () => {
  const parsed = parseStorageErrorText("DATA_DIR_NOT_MOUNTED: DataDirNotMounted");
  expect(parsed.code).toBe("DATA_DIR_NOT_MOUNTED");
  expect(parsed.detail).toBe("DataDirNotMounted");
  expect(parsed.message).toContain("not mounted");
});

test("an unconfigured microservice is distinguishable from a failed operation", () => {
  expect(parseStorageErrorText("DATA_DIR_NOT_CONFIGURED: DataDirNotConfigured").code)
    .toBe("DATA_DIR_NOT_CONFIGURED");
  expect(parseStorageErrorText("STORE_NOT_FOUND: StoreNotFound").code)
    .toBe("STORE_NOT_FOUND");
});

test("text without a code keeps its full message", () => {
  const parsed = parseStorageErrorText("open failed: something odd");
  expect(parsed.code).toBe("STORAGE_INTERNAL");
  expect(parsed.detail).toBe("open failed: something odd");
  expect(parsed.message).toBe("open failed: something odd");
});

test("every code has a description", () => {
  for (const code of StorageErrorCodes) {
    expect(parseStorageErrorText(`${code}: detail`).message.length).toBeGreaterThan(0);
  }
});
