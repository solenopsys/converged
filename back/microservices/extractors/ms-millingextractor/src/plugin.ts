import { createHttpBackend } from "nrpc";
import { metadata } from "g-millingextractor";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
