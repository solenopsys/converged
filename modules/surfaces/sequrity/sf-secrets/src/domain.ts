import { createDomain } from "effector";
import { createDomainLogger } from "front-core";

const domain = createDomain("secrets");
createDomainLogger(domain);

export default domain;
