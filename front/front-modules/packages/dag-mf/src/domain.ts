import { createDomain } from "effector";
const domain = createDomain('dag');
import { createDomainLogger } from "converged-core";
//logger
createDomainLogger(domain);

export default domain;
