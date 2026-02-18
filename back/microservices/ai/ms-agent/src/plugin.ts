import { createHttpBackend } from "nrpc";
import { metadata } from "g-agent";
import AgentServiceImpl from "./index";
import type { AgentServiceConfig } from "./types";

export default (config?: Partial<AgentServiceConfig>) => {
  const serviceImpl = new AgentServiceImpl(config);
  return createHttpBackend({ metadata, serviceImpl });
};
