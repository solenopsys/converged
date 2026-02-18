import { createHttpBackend } from "nrpc";
import { metadata } from "g-facebook";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
