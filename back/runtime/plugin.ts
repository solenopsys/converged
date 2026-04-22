import { createHttpBackend } from "nrpc";
import { metadata as dagMetadata } from "g-rt-dag";
import { metadata as cronMetadata } from "g-rt-cron";
import { metadata as gatesMetadata } from "g-rt-gates";
import {
  CronRuntimeService,
  DagRuntimeService,
  GatesRuntimeService,
} from "./service";

export default function runtimePlugin(config?: any) {
  const dagBackend = createHttpBackend({
    metadata: dagMetadata,
    serviceImpl: new DagRuntimeService(config),
    pathPrefix: "/runtime",
  })(config);
  const cronBackend = createHttpBackend({
    metadata: cronMetadata,
    serviceImpl: new CronRuntimeService(config),
    pathPrefix: "/runtime",
  })(config);
  const gatesBackend = createHttpBackend({
    metadata: gatesMetadata,
    serviceImpl: new GatesRuntimeService(config),
    pathPrefix: "/runtime",
  })(config);

  return (app: any) => app.use(dagBackend).use(cronBackend).use(gatesBackend);
}
