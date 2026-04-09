import { createNotifyServiceClient } from "g-notify";
import { createSmtpServiceClient } from "g-smtp";

const host = process.env.SERVICES_BASE ?? "http://localhost:3000/services";

const notify = createNotifyServiceClient({ baseUrl: host });

function renderTemplate(
  content: Record<string, string>,
  params: Record<string, string | number | boolean | null>,
): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, value] of Object.entries(content)) {
    result[key] = value.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? ""));
  }
  return result;
}

export async function sendNotification({
  channel,
  templateId,
  recipient,
  params = {},
}: {
  channel: string;
  templateId: string;
  recipient: string;
  params?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const channelConfig = await notify.getChannel(channel);
  if (!channelConfig) throw new Error(`Channel "${channel}" not configured`);

  const template = await notify.getTemplate(templateId);
  if (!template) throw new Error(`Template "${templateId}" not found`);

  const rendered = renderTemplate(template.content, params);

  if (channelConfig.type === "smtp") {
    const { serviceUrl, host: smtpHost, port, secure, user, pass, from } = channelConfig.config;
    const smtp = createSmtpServiceClient({ baseUrl: serviceUrl });
    await smtp.sendEmail(
      {
        from: from ?? user,
        to: recipient,
        subject: rendered.subject ?? "",
        body: rendered.body ?? "",
        type: "html",
      },
      {
        host: smtpHost,
        port: Number(port),
        secure: Boolean(secure),
        auth: user ? { user, pass } : undefined,
      },
    );
  } else {
    throw new Error(`Unsupported channel type "${channelConfig.type}"`);
  }

  await notify.recordSend({ channel, templateId, recipient, params, status: "sent" });
}
