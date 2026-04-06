import { FileStore } from "../files/file-store";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export class JsonStore extends FileStore {
  async putJson<T>(key: string, value: T): Promise<void> {
    await this.put(key + ".json", encoder.encode(JSON.stringify(value, null, 2)));
  }

  async getJson<T>(key: string): Promise<T | undefined> {
    const data = await this.get(key + ".json");
    if (!data) return undefined;
    return JSON.parse(decoder.decode(data)) as T;
  }

  async deleteJson(key: string): Promise<boolean> {
    return this.delete(key + ".json");
  }

  existsJson(key: string): boolean {
    return this.exists(key + ".json");
  }

  async listJsonKeys(): Promise<string[]> {
    const keys = await this.listKeys();
    return keys
      .filter((k) => k.endsWith(".json"))
      .map((k) => k.slice(0, -5));
  }

  async listAllJson<T>(): Promise<T[]> {
    const keys = await this.listJsonKeys();
    const results: T[] = [];
    for (const key of keys) {
      const value = await this.getJson<T>(key);
      if (value !== undefined) results.push(value);
    }
    return results;
  }
}
