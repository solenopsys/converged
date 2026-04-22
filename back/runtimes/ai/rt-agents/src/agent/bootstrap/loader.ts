import { readFileSync, existsSync } from "fs";
import { join, resolve } from "path";

export interface BootstrapContent {
  soul: string;
  user: string;
  agents: string;
}

const DEFAULT_DIR = resolve(import.meta.dir, "defaults");

export class BootstrapLoader {
  private dir: string;
  private cache: BootstrapContent | null = null;

  constructor(customDir?: string) {
    this.dir = customDir || DEFAULT_DIR;
  }

  load(): BootstrapContent {
    if (this.cache) return this.cache;

    this.cache = {
      soul: this.readFile("SOUL.md"),
      user: this.readFile("USER.md"),
      agents: this.readFile("AGENTS.md"),
    };
    return this.cache;
  }

  reload(): BootstrapContent {
    this.cache = null;
    return this.load();
  }

  private readFile(filename: string): string {
    const filePath = join(this.dir, filename);
    if (existsSync(filePath)) {
      return readFileSync(filePath, "utf-8");
    }
    const defaultPath = join(DEFAULT_DIR, filename);
    if (existsSync(defaultPath)) {
      return readFileSync(defaultPath, "utf-8");
    }
    return "";
  }
}
