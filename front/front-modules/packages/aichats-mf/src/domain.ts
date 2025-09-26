import { createDomainLogger } from "converged-core";
import { createDomain } from "effector";
import { chatDomain } from "front-chat-core";
const domain =createDomain('aichat');
//logger
createDomainLogger(domain);
createDomainLogger(chatDomain);
export default domain;
