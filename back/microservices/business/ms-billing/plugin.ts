import { createHttpBackend } from "nrpc";
import { metadata } from "g-billing";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
