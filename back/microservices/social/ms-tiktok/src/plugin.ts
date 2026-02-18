import { createHttpBackend } from "nrpc";
import { metadata } from "g-tiktok";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
