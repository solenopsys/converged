import { createDomainLogger } from "front-core";
import { createDomain } from "effector";

const domain = createDomain("agents");
createDomainLogger(domain);

export default domain;
