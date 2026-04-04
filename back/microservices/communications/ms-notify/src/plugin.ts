import { createHttpBackend } from "nrpc";
import { metadata } from "g-notify";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
