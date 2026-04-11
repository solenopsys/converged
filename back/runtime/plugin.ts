import { createHttpBackend } from "nrpc";
import { metadata } from "g-runtime";
import RuntimeServiceImpl from "./service";

export default function runtimePlugin(config?: any) {
  const serviceImpl = new RuntimeServiceImpl(config);
  return createHttpBackend({ metadata, serviceImpl })(config);
}
