import { createHttpBackend } from "nrpc";
import { metadata } from "g-static";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
