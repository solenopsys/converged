


import BuildController from "./services/build_controller";
import CacheStore from "./services/store";

const rootDir = "/home/alexstorm/distrib/hyperconverged/";
const cacheDir = "/home/alexstorm/distrib/hyperconverged/cache";
// make dir store
const store = `${cacheDir}/store`;
import { promises as fs } from "fs";

if (!(await fs.exists(store))) {
    await fs.mkdir(cacheDir);
	await fs.mkdir(store);
}

const buildController = new BuildController(rootDir, cacheDir);

buildController.ws.addDefaultExternal("@solenopsys/converged-reactive");
buildController.ws.addDefaultExternal("@solenopsys/converged-renderer");
buildController.ws.addDefaultExternal("@solenopsys/converged-router");
buildController.ws.addDefaultExternal("@solenopsys/converged-style");
 

export default buildController;
