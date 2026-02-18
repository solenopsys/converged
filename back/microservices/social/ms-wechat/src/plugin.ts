import { createHttpBackend } from "nrpc";
import { metadata } from "g-wechat";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
