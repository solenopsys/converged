import { JSONPath } from "jsonpath-plus";
import { ProcessingStoreService } from "../store/processing";

const getByPath = (data: any, path: string): any => {
  if (!path) return undefined;
  if (path.startsWith("$")) {
    try {
      const result = JSONPath({ path, json: data });
      return Array.isArray(result) ? result[0] : result;
    } catch {
      return undefined;
    }
  }
  const parts = path.split(".");
  let current = data;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
};

export class StoreExecutionContext {
  public context: any;
  public readonly contextKey: string;

  constructor(private store: ProcessingStoreService, contextKey: string) {
    this.contextKey = contextKey;
    this.context = this.store.getContext(contextKey) ?? {};
  }

  refresh() {
    this.context = this.store.getContext(this.contextKey) ?? {};
  }

  getFromPath(path: string): any {
    return getByPath(this.context, path);
  }

  setToPath(path: string, value: any): void {
    if (path.indexOf(".") > 0) {
      throw new Error("Only simple paths are supported");
    }
    this.store.addDataToContext(this.contextKey, path, value);
    this.context = { ...this.context, [path]: value };
  }
}
