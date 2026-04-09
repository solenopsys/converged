import { useState } from "react";
import { useStore } from "effector-react";
import { cn, Button, Input, Label, useMicrofrontendTranslation } from "front-core";
import { toast } from "sonner";
import { SocialsPanel } from "./Socials";
import { $magicLinkStatus, $magicLinkError, magicLinkSend } from "../model";

const AUTH_MF_ID = "auth-mf";

export function LoginForm({ className, ...props }: React.ComponentProps<"div">) {
  const { t } = useMicrofrontendTranslation(AUTH_MF_ID);
  const status = useStore($magicLinkStatus);
  const error  = useStore($magicLinkError);

  const [email, setEmail] = useState("");

  const sending = status === "sending";
  const sent    = status === "sent";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || sending) return;
    magicLinkSend(email.trim());
  };

  if (sent) {
    return (
      <div className={cn("flex h-full flex-col items-center justify-center gap-2 px-6", className)} {...props}>
        <p className="text-center text-sm font-medium">{t("notification.linkSent")}</p>
        <p className="text-center text-xs text-muted-foreground">{t("notification.checkEmail")}</p>
      </div>
    );
  }

  return (
    <div className={cn("flex h-full flex-col", className)} {...props}>
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t("welcome.heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("welcome.description")}</p>
      </div>

      <form className="flex-1 overflow-auto px-6 py-4" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">{t("form.email")}</Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-xs text-destructive">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={!email.trim() || sending}>
            {sending ? t("button.sendingLink") : t("button.sendAuthLink")}
          </Button>
        </div>
      </form>

      <div className="border-t px-6 py-4">
        <SocialsPanel />
      </div>
    </div>
  );
}
