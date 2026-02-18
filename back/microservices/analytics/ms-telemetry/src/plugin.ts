import { createHttpBackend } from "nrpc";
import { metadata } from "g-telemetry";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
