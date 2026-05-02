import { createEvent } from "effector";

export const chatSendRequested = createEvent<string>();
export const chatInitRequested = createEvent<{ contextName?: string } | void>();
export const chatAttachRequested = createEvent<void>();
