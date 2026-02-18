import { createDomainLogger } from "front-core";
import { createDomain } from "effector";
import { chatDomain } from "assistant-state";
const domain =createDomain('assistant');
//logger
createDomainLogger(domain);
createDomainLogger(chatDomain);
export default domain;
