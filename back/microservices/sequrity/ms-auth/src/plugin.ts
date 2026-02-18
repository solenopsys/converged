import { createHttpBackend } from "nrpc";
import { metadata } from "g-auth";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
