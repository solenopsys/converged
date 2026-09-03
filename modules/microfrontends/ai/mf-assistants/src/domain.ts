import { chatDomain } from "assistant-state";
import { createDomain } from "effector";
import { createDomainLogger } from "front-core";

const domain = createDomain("assistant");
createDomainLogger(domain);
createDomainLogger(chatDomain);
export default domain;
