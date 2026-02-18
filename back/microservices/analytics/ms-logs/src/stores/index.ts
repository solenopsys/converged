import { DATA_DIR } from "back-core";
import { join } from "path";
import { LogsHotStore } from "./hot/service";
import { LogsColdStore } from "./cold/service";

export class StoresController {
  public hot: LogsHotStore;
  public cold: LogsColdStore;

  constructor(msName: string, baseDir: string = DATA_DIR) {
    const serviceDir = join(baseDir, msName);
    this.hot = new LogsHotStore(join(serviceDir, "hot"));
    this.cold = new LogsColdStore(join(serviceDir, "cold", "data.db"));
  }

  async init(): Promise<void> {
    await this.cold.init();
  }

  async destroy(): Promise<void> {
    await this.hot.closeCurrent();
    await this.cold.close();
  }
}
