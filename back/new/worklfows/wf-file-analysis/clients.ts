// RT-transport microservice clients. Calls cross into Zig via globalThis.rt and
// pass references (CacheRef), not bytes. bun tree-shakes unused methods away.

import { createFilesServiceRtClient } from "g-files/rt";
import { createMillingExtractorServiceRtClient } from "g-millingextractor/rt";
import { createModelConvertorServiceRtClient } from "g-modelconvertor/rt";
import { createPrintExtractorServiceRtClient } from "g-printextractor/rt";

export const files = createFilesServiceRtClient();
export const models = createModelConvertorServiceRtClient();
export const milling = createMillingExtractorServiceRtClient();
export const print = createPrintExtractorServiceRtClient();
