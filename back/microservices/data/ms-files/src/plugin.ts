import { createHttpBackend } from "nrpc";
import { metadata } from "g-files";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
