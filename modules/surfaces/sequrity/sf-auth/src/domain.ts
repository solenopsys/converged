import { createDomain } from "effector";
import { createDomainLogger } from "front-core";

const domain = createDomain("auth");
createDomainLogger(domain);

export default domain;
