import { createHttpBackend } from "nrpc";
import { metadata } from "g-modelconvertor";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
