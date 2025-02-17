import BuildController from "./tools/build_controller.ts";
import CacheStore from "./tools/db.ts";



const rootDir = "/home/alexstorm/distrib/hyperconverged/"
const cacheDir="/home/alexstorm/distrib/hyperconverged/cache"
// make dir store
const store = `${cacheDir}/store`
import { promises as fs } from 'fs';

await fs.mkdir(store);

const buildController = new BuildController(rootDir,cacheDir);

buildController.ws.addDefaultExternal("@solenopsys/converged-reactive");
buildController.ws.addDefaultExternal("@solenopsys/converged-renderer");
buildController.ws.addDefaultExternal("@solenopsys/converged-router");
buildController.ws.addDefaultExternal("@solenopsys/converged-style");
  
await buildController.init();

await buildController.runBuildTask('core/reactive');
await buildController.runBuildTask('core/renderer');
await buildController.runBuildTask('core/router');
await buildController.runBuildTask('core/style');


 await buildController.runBuildTask('libs/solenopsys/ui-controls');
 await buildController.runBuildTask('libs/solenopsys/ui-forms');
 await buildController.runBuildTask('libs/solenopsys/ui-lists');
 await buildController.runBuildTask('libs/solenopsys/ui-content');