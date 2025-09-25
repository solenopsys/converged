import { createDomainLogger } from "converged-core";
import { createDomain } from "effector";
const domain =createDomain('chat');
//logger
createDomainLogger(domain);
export default domain;
