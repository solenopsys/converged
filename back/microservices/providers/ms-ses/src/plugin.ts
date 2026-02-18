import { createHttpBackend } from "nrpc";
import { metadata } from "g-ses";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
