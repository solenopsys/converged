import { createHttpBackend } from "nrpc";
import { metadata } from "g-discord";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
