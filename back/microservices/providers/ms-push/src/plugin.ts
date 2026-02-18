import { createHttpBackend } from "nrpc";
import { metadata } from "g-push";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
