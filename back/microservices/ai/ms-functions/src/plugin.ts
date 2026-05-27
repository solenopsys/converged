import { createHttpBackend } from "nrpc";
import { metadata } from "g-functions";
import FunctionsServiceImpl from "./index";

let serviceImpl: FunctionsServiceImpl | null = null;

function getServiceImpl() {
  if (!serviceImpl) {
    serviceImpl = new FunctionsServiceImpl();
  }
  return serviceImpl;
}

export default createHttpBackend({
  metadata,
  get serviceImpl() {
    return getServiceImpl();
  },
});
