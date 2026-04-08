import { createAuthServiceClient } from "g-auth";
import { createNotifyServiceClient } from "g-notify";

const host = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

const auth = createAuthServiceClient({ baseUrl: host });
const notify = createNotifyServiceClient({ baseUrl: host });

export async function sendMagicLink({
  email,
  returnTo,
  channel = "smtp",
  templateId = "magic-link",
}: {
  email: string;
  returnTo?: string;
  channel?: string;
  templateId?: string;
}): Promise<void> {
  const { token } = await auth.getMagicLink(email, returnTo);
  const link = `${frontendUrl}/auth/verify?token=${token}`;
  await notify.send({ channel, templateId, recipient: email, params: { link, email, token } });
}
