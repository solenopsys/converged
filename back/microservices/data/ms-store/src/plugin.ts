import { createHttpBackend } from "nrpc";
import { metadata } from "g-store";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
