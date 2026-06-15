import { createHttpBackend } from "nrpc";
import { metadata } from "g-contexts";
import ContextsServiceImpl from "./index";

let serviceImpl: ContextsServiceImpl | null = null;

function getServiceImpl() {
  if (!serviceImpl) {
    serviceImpl = new ContextsServiceImpl();
  }
  return serviceImpl;
}

export default createHttpBackend({
  metadata,
  get serviceImpl() {
    return getServiceImpl();
  },
});
