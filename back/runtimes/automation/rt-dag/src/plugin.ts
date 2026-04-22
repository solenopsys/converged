import { createHttpBackend } from "nrpc";
import { metadata } from "g-runtime";
import { DagRuntimeService } from "converged-runtime/service";

const methodNames = new Set([
  "startExecution",
  "createExecution",
  "resumeActiveExecutions",
  "listWorkflows",
]);

const dagMetadata = {
  ...metadata,
  methods: metadata.methods.filter((method) => methodNames.has(method.name)),
};

export default function dagRuntimePlugin(config?: any) {
  const serviceImpl = new DagRuntimeService(config);
  return createHttpBackend({ metadata: dagMetadata, serviceImpl })(config);
}
