import { createHttpBackend } from "nrpc";
import { metadata } from "g-identity";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
