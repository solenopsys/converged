import { createHttpBackend } from "nrpc";
import { metadata } from "g-rt-gates";
import { GatesRuntimeService } from "converged-runtime/service";

export default function gatesRuntimePlugin(config?: any) {
  const serviceImpl = new GatesRuntimeService(config);
  return createHttpBackend({ metadata, serviceImpl, pathPrefix: "/runtime" })(config);
}
