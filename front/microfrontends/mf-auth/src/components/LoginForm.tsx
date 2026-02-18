import { useState } from "react"
import { cn } from "front-core"
import { Button } from "front-core"
import { Input } from "front-core"
import { Label } from "front-core"
import { toast } from "sonner"
import { useMicrofrontendTranslation } from "front-core"
import { SocialsPanel } from "./Socials"

const AUTH_MF_ID = "auth-mf";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {

  const { t } = useMicrofrontendTranslation(AUTH_MF_ID);

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [showPasswordField, setShowPasswordField] = useState(false)

  // Handle sending auth link
  const handleSendAuthLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return

    setLoading(true)

    try {
      const response = await fetch("/auth/send-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || t("notification.sendLinkFailed"))
      }

      toast.success(t("notification.linkSent"), {
        description: t("notification.checkEmail"),
      })
    } catch (error) {
      toast.error(t("notification.sendLinkFailed"), {
        description: error instanceof Error ? error.message : t("notification.tryAgain"),
      })
    } finally {
      setLoading(false)
    }
  }

  // Handle email/password login
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
        credentials: "include",
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || t("notification.loginFailed"))
      }

      // Save token or handle successful login
      if (data.token) {
        localStorage.setItem("authToken", data.token)
        window.dispatchEvent(new Event("auth-token-changed"))
        window.location.href = "/dashboard" // Redirect to dashboard
      }
    } catch (error) {
      toast.error(t("notification.loginFailed"), {
        description: error instanceof Error ? error.message : t("notification.tryAgain"),
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = showPasswordField ? handleEmailLogin : handleSendAuthLink
  const canSubmit = email.trim() && (!showPasswordField || password.trim())

  return (
    <div className={cn("flex h-full flex-col", className)} {...props}>
      <div className="border-b px-6 py-4">
        <h2 className="text-lg font-semibold">{t("welcome.heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("welcome.description")}</p>
      </div>

      <form className="flex-1 overflow-auto px-6 py-4" onSubmit={handleSubmit}>
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="email">{t("form.email")}</Label>
              {email.trim() && (
                <a
                  href="#"
                  className="ml-auto text-xs underline-offset-2 hover:underline"
                  onClick={(e) => {
                    e.preventDefault()
                    setShowPasswordField(!showPasswordField)
                  }}
                >
                  {showPasswordField ? t("form.sendLink") : t("form.loginWithPassword")}
                </a>
              )}
            </div>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {showPasswordField && (
            <div className="space-y-2">
              <Label htmlFor="password">{t("form.password")}</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          )}

          <Button type="submit" className="w-full" disabled={!canSubmit || loading}>
            {loading
              ? (showPasswordField ? t("button.loggingIn") : t("button.sendingLink"))
              : (showPasswordField ? t("button.login") : t("button.sendAuthLink"))
            }
          </Button>
        </div>
      </form>

      <div className="border-t px-6 py-4">
        <SocialsPanel />
      </div>
    </div>
  )
}
