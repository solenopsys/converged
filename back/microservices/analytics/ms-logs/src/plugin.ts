import { createHttpBackend } from "nrpc";
import { metadata } from "g-logs";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
