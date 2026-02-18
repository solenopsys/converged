import { createHttpBackend } from "nrpc";
import { metadata } from "g-youtube";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
