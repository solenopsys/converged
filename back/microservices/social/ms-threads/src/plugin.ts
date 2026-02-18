import { createHttpBackend } from "nrpc";
import { metadata } from "g-threads";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
