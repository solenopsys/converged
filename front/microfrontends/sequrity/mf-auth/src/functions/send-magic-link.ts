import { CreateAction } from "front-core";
import { createEffect, sample } from "effector";
import { dagClient } from "g-dag";
import domain from "../domain";

export const SEND_MAGIC_LINK = "auth.send-magic-link";

export const sendMagicLinkFx = domain.createEffect({
  name: "SEND_MAGIC_LINK",
  handler: ({ email, returnTo }: { email: string; returnTo?: string }) =>
    dagClient.createExecution("send-magic-link", { email, returnTo }),
});

export const createSendMagicLinkAction: CreateAction<{ email: string; returnTo?: string }> = () => ({
  id: SEND_MAGIC_LINK,
  description: "Send magic link to email via workflow",
  invoke: (params) => sendMagicLinkFx(params),
});
