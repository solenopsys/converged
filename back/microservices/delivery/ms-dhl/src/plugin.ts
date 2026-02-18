import { createHttpBackend } from "nrpc";
import { metadata } from "g-shipmentprovider";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
  configEnvVar: "DHL_CONFIG",
});
