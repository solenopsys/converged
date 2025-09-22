import { createDomainLogger } from "converged-core";
import { createDomain } from "effector";
const domain =createDomain('mailing');
//logger
createDomainLogger(domain);
export default domain;
