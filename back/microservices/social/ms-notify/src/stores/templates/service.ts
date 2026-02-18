import { FileStore } from "back-core";
import type {
  NotifyTemplate,
  NotifyTemplateId,
  NotifyTemplateInput,
} from "../../types";

const TEMPLATE_EXT = ".json";

export class NotifyTemplateStoreService {
  constructor(private store: FileStore) {}

  async save(template: NotifyTemplateInput): Promise<NotifyTemplateId> {
    const key = this.toKey(template.id);
    const data = new TextEncoder().encode(JSON.stringify(template.content));
    await this.store.put(key, data);
    return template.id;
  }

  async get(id: NotifyTemplateId): Promise<NotifyTemplate | undefined> {
    const data = await this.store.get(this.toKey(id));
    if (!data) {
      return undefined;
    }
    const content = this.parseContent(data);
    return { id, content };
  }

  async list(): Promise<NotifyTemplate[]> {
    const keys = await this.store.listKeys();
    keys.sort();

    const templates: NotifyTemplate[] = [];
    for (const key of keys) {
      if (!key.endsWith(TEMPLATE_EXT)) {
        continue;
      }
      const data = await this.store.get(key);
      if (!data) {
        continue;
      }
      const content = this.parseContent(data);
      templates.push({ id: this.fromKey(key), content });
    }
    return templates;
  }

  async delete(id: NotifyTemplateId): Promise<boolean> {
    return this.store.delete(this.toKey(id));
  }

  private toKey(id: NotifyTemplateId): string {
    if (id.endsWith(TEMPLATE_EXT)) {
      return id;
    }
    return `${id}${TEMPLATE_EXT}`;
  }

  private fromKey(key: string): NotifyTemplateId {
    if (key.endsWith(TEMPLATE_EXT)) {
      return key.slice(0, -TEMPLATE_EXT.length);
    }
    return key;
  }

  private parseContent(data: Uint8Array): Record<string, string> {
    try {
      const text = new TextDecoder().decode(data);
      const value = JSON.parse(text);
      if (value && typeof value === "object") {
        return value as Record<string, string>;
      }
    } catch {}
    return {};
  }
}
