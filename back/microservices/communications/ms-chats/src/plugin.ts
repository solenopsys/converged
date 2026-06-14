import { createHttpBackend } from "nrpc";
import { metadata } from "g-chats";
import serviceImpl from "./index";

export default createHttpBackend({
  metadata,
  serviceImpl,
});
