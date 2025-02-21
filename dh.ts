import buildController from "./develop/init";

// await buildController.runBuildTaskPack("@solenopsys/lt-website");
// await buildController.runBuildTask("core/renderer");
await buildController.runBuildTaskPack("@solenopsys/converged-reactive");
await buildController.runBuildTaskPack("@solenopsys/converged-renderer");
await buildController.runBuildTaskPack("@solenopsys/converged-router");
await buildController.runBuildTaskPack("@solenopsys/converged-style");


 //await buildController.runBuildTaskPack("@solenopsys/ui-navigate");
//  await buildController.runBuildTask("libs/solenopsys/ui-navigate");

//  await buildController.runBuildTask("core/reactive");
// await buildController.runBuildTask("core/renderer");
// await buildController.runBuildTask("core/router");
//  await buildController.runBuildTask("core/style");

// await buildController.runBuildTask("libs/solenopsys/ui-controls");
// await buildController.runBuildTask("libs/solenopsys/ui-forms");
// await buildController.runBuildTask("libs/solenopsys/ui-lists");
// await buildController.runBuildTask("libs/solenopsys/ui-content");


// await buildController.runBuildTask("libs/solenopsys/lt-website");
// await buildController.runBuildTask("libs/solenopsys/mf-landing");