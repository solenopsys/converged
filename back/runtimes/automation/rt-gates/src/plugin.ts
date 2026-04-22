import { createHttpBackend } from "nrpc";
import { metadata } from "g-runtime";
import { GatesRuntimeService } from "converged-runtime/service";

const methodNames = new Set(["sendMagicLink"]);

const gatesMetadata = {
  ...metadata,
  methods: metadata.methods.filter((method) => methodNames.has(method.name)),
};

export default function gatesRuntimePlugin(config?: any) {
  const serviceImpl = new GatesRuntimeService(config);
  return createHttpBackend({ metadata: gatesMetadata, serviceImpl })(config);
}
