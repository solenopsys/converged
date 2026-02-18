import { DATA_DIR } from "back-core";
import { join } from "path";
import { TelemetryHotStore } from "./hot/service";
import { TelemetryColdStore } from "./cold/service";

export class StoresController {
  public hot: TelemetryHotStore;
  public cold: TelemetryColdStore;

  constructor(msName: string, baseDir: string = DATA_DIR) {
    const serviceDir = join(baseDir, msName);
    this.hot = new TelemetryHotStore(join(serviceDir, "hot"));
    this.cold = new TelemetryColdStore(join(serviceDir, "cold", "data.db"));
  }

  async init(): Promise<void> {
    await this.cold.init();
  }

  async destroy(): Promise<void> {
    await this.hot.closeCurrent();
    await this.cold.close();
  }
}
