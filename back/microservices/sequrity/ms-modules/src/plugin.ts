import { createHttpBackend } from "nrpc";
import { metadata } from "g-modules";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
