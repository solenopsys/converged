import { createHttpBackend } from "nrpc";
import { metadata } from "g-video";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
