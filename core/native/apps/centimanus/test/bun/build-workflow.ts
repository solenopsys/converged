// Workflow bundling for the tests: the real builder lives in dag-core
// (tools/dag/core/build.ts). Workspace imports (dag-core, g-*/rt, nrpc)
// resolve from the workflow's own location, so no redirects are needed here.

import { join } from "node:path";

const converged = join(import.meta.dir, "../../../../..");

export { buildWorkflow } from "../../../../../tools/dag/core/build.ts";

export const WF_FILES_PROCESS = join(converged, "modules/workflows/wf-files-process/index.ts");
