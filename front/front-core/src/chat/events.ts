import { createEvent } from "effector";

export const chatSendRequested = createEvent<string>();
export const chatInitRequested = createEvent<void>();
