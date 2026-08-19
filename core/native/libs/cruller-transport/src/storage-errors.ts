/**
 * Codes storage puts in front of the error text of a response (see
 * navite/libs/transport/src/storage/errors.zig — that file is the source of
 * this list). They let a caller separate "your volume is not attached" from an
 * ordinary failed operation instead of matching on message text.
 */
export const StorageErrorCodes = [
  "DATA_DIR_NOT_CONFIGURED",
  "DATA_DIR_NOT_MOUNTED",
  "STORAGE_CONFIG_INVALID",
  "INVALID_NAME",
  "STORE_NOT_FOUND",
  "STORE_TYPE_MISMATCH",
  "UNSUPPORTED_OPERATION",
  "NOT_FOUND",
  "STORAGE_INTERNAL",
] as const;

export type StorageErrorCode = (typeof StorageErrorCodes)[number];

const STORAGE_ERROR_CODES = new Set<string>(StorageErrorCodes);

const STORAGE_ERROR_DESCRIPTIONS: Record<StorageErrorCode, string> = {
  DATA_DIR_NOT_CONFIGURED:
    "microservice has no data directory in the storage mount configuration",
  DATA_DIR_NOT_MOUNTED: "data directory of the microservice is not mounted",
  STORAGE_CONFIG_INVALID: "storage mount configuration is missing or invalid",
  INVALID_NAME: "microservice or store name is not a valid path segment",
  STORE_NOT_FOUND: "store is not open",
  STORE_TYPE_MISMATCH: "store already exists with a different type",
  UNSUPPORTED_OPERATION: "operation is not supported by this store type",
  NOT_FOUND: "requested entry does not exist",
  STORAGE_INTERNAL: "storage operation failed",
};

/**
 * Splits `CODE: detail` coming from storage. Text without a known code (an
 * older storage build, or a transport-level message) keeps its full text and
 * is reported as STORAGE_INTERNAL.
 */
export function parseStorageErrorText(text: string): {
  code: StorageErrorCode;
  detail: string;
  message: string;
} {
  const separator = text.indexOf(": ");
  const head = separator === -1 ? text : text.slice(0, separator);
  if (!STORAGE_ERROR_CODES.has(head)) {
    return { code: "STORAGE_INTERNAL", detail: text, message: text };
  }
  const code = head as StorageErrorCode;
  const detail = separator === -1 ? "" : text.slice(separator + 2);
  const description = STORAGE_ERROR_DESCRIPTIONS[code];
  return {
    code,
    detail,
    message: detail ? `${description} (${detail})` : description,
  };
}

