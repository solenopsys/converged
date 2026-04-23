import { createNotifyServiceClient } from "g-notify";
import { createSmtpServiceClient } from "g-smtp";
import { createSesServiceClient } from "g-ses";
import { requireServicesBaseUrl } from "../env";

const host = requireServicesBaseUrl();

const notify = createNotifyServiceClient({ baseUrl: host });
const ses = createSesServiceClient({ baseUrl: host });

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

async function handleSmtp(
  config: Record<string, any>,
  recipient: string,
  rendered: Record<string, string>,
): Promise<void> {
  const { serviceUrl, host: smtpHost, port, secure, user, pass, from } = config;
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
}

async function handleSes(
  config: Record<string, any>,
  recipient: string,
  rendered: Record<string, string>,
): Promise<void> {
  const { accessKeyId, secretAccessKey, region, from } = config;
  const result = await ses.sendEmail(
    {
      from,
      to: recipient,
      subject: rendered.subject ?? "",
      body: rendered.body ?? "",
      type: "html",
    },
    { accessKeyId, secretAccessKey, region },
  );
  if (!result.success) throw new Error(`SES send failed: ${result.error}`);
}

function normalizeLocale(input?: string): string | undefined {
  if (!input) return undefined;
  const cleaned = input.trim().toLowerCase().replace("_", "-");
  if (!cleaned) return undefined;
  const short = cleaned.split("-")[0];
  return short || undefined;
}

async function resolveTemplate(
  templateId: string,
  locale?: string,
): Promise<{ templateId: string; content: Record<string, string> }> {
  const candidates: string[] = [];
  const normalizedLocale = normalizeLocale(locale);

  if (normalizedLocale) {
    candidates.push(`${normalizedLocale}/${templateId}`);
    // Backward-compatible fallback for old naming scheme
    candidates.push(`${templateId}.${normalizedLocale}`);
  }
  candidates.push(templateId);

  for (const candidate of candidates) {
    const template = await notify.getTemplate(candidate);
    if (template) {
      return { templateId: candidate, content: template.content };
    }
  }

  throw new Error(`Template "${templateId}" not found`);
}

export async function sendNotification({
  channel,
  templateId,
  recipient,
  locale,
  params = {},
}: {
  channel: string;
  templateId: string;
  recipient: string;
  locale?: string;
  params?: Record<string, string | number | boolean | null>;
}): Promise<void> {
  const channelConfig = await notify.getChannel(channel);
  if (!channelConfig) throw new Error(`Channel "${channel}" not configured`);

  const selected = await resolveTemplate(templateId, locale);

  const rendered = renderTemplate(selected.content, params);

  const handlers: Record<string, (config: Record<string, any>, recipient: string, rendered: Record<string, string>) => Promise<void>> = {
    smtp: handleSmtp,
    ses: handleSes,
  };

  const handler = handlers[channelConfig.type];
  if (!handler) throw new Error(`Unsupported channel type "${channelConfig.type}"`);
  await handler(channelConfig.config, recipient, rendered);

  await notify.recordSend({
    channel,
    templateId: selected.templateId,
    recipient,
    params,
    status: "sent",
  });
}
