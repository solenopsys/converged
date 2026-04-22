import { createHttpBackend } from "nrpc";
import { metadata } from "g-runtime";
import { CronRuntimeService } from "converged-runtime/service";

const methodNames = new Set(["refreshCrons"]);

const cronMetadata = {
  ...metadata,
  methods: metadata.methods.filter((method) => methodNames.has(method.name)),
};

export default function cronRuntimePlugin(config?: any) {
  const serviceImpl = new CronRuntimeService(config);
  return createHttpBackend({ metadata: cronMetadata, serviceImpl })(config);
}
