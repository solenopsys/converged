import { createHttpBackend } from "nrpc";
import { metadata } from "g-struct";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
