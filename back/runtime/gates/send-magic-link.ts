import { createAuthServiceClient } from "g-auth";
import { sendNotification } from "./send-notification";

const host = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

const auth = createAuthServiceClient({ baseUrl: host });

export async function sendMagicLink({
  email,
  returnTo,
  channel = process.env.MAGIC_LINK_CHANNEL ?? "smtp",
  templateId = "magic-link",
}: {
  email: string;
  returnTo?: string;
  channel?: string;
  templateId?: string;
}): Promise<void> {
  const { token } = await auth.getMagicLink(email, returnTo);
  const link = `${frontendUrl}/services/auth/verify?token=${token}`;
  await sendNotification({ channel, templateId, recipient: email, params: { link, email, token } });
}
