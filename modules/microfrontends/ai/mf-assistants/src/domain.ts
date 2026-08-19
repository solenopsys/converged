import { createDomainLogger } from "front-core";
import { createDomain } from "effector";
import { chatDomain } from "assistant-state";
const domain =createDomain('assistant');
createDomainLogger(domain);
createDomainLogger(chatDomain);
export default domain;
