import { Workflow, type WorkflowContext } from "ms-dag/workflow";
import AuthProvider from "./providers/auth";
import NotifyProvider from "./providers/notify";

const host = process.env.SERVICES_BASE ?? "http://localhost:3000/services";
const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:3000";

export class SendMagicLinkWorkflow extends Workflow {
  private auth = new AuthProvider(host);
  private notify = new NotifyProvider(host);

  constructor(ctx: WorkflowContext, id?: string) {
    super(ctx, id);
  }

  async execute({ email, returnTo, channel = "smtp", templateId = "magic-link" }: {
    email: string;
    returnTo?: string;
    channel?: string;
    templateId?: string;
  }): Promise<void> {
    const { token } = await this.invoke("get-magic-link", () =>
      this.auth.invoke("getMagicLink", { email, returnTo })
    );

    const link = `${frontendUrl}/auth/verify?token=${token}`;

    await this.invoke("send-notification", () =>
      this.notify.invoke("send", {
        channel,
        templateId,
        recipient: email,
        params: { link, email, token },
      })
    );
  }
}
