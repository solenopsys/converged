import { createHttpBackend } from "nrpc";
import { metadata } from "g-smtp";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
