import { createHttpBackend } from "nrpc";
import { metadata } from "g-rt-cron";
import { CronRuntimeService } from "converged-runtime/service";

export default function cronRuntimePlugin(config?: any) {
  const serviceImpl = new CronRuntimeService(config);
  return createHttpBackend({ metadata, serviceImpl, pathPrefix: "/runtime" })(config);
}
