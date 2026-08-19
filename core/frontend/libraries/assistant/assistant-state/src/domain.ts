import { createDomain } from "effector";
import { createDomainLogger } from "../../../effector/effector-logger/logger";

export const chatDomain = createDomain("chat-core");
createDomainLogger(chatDomain);
