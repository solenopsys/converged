import { createHttpBackend } from "nrpc";
import { metadata } from "g-rt-dag";
import { DagRuntimeService } from "converged-runtime/service";

export default function dagRuntimePlugin(config?: any) {
  const serviceImpl = new DagRuntimeService(config);
  return createHttpBackend({ metadata, serviceImpl, pathPrefix: "/runtime" })(config);
}
