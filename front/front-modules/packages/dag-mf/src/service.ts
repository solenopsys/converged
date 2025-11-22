import { DagService } from "../../../../../adag/dag-types/interface";

import { createDagServiceClient } from "../dist/generated";

export default  createDagServiceClient({baseUrl:"https://console.4ir.club"}) as DagService;
