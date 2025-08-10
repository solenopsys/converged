import { useState } from "react"
import { cn } from "converged-core"
import { Button } from "converged-core"
import { Card, CardContent } from "converged-core"
import { Input } from "converged-core"
import { Label } from "converged-core"
import { toast } from "sonner" // Using Sonner instead of the deprecated toast component
 
import { useGlobalTranslation } from "converged-core";
import {Socials} from "./Socials";

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) { 

  const { t, i18n } = useGlobalTranslation("login");
  
  // Получаем данные для legal блока
  const legalData = i18n.getResource(i18n.language, 'login', 'legal');

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

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card className="overflow-hidden p-0">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 md:p-8" onSubmit={handleSubmit}>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col items-center text-center">
                <h1 className="text-2xl font-bold">{t('welcome.heading')}</h1>
                <p className="text-muted-foreground text-balance">
                  {t('welcome.description')}
                </p>

                <img src="/assets/logo.svg" alt="Logo" className="w-36 h-36 m-10" />


              </div>
              
              <div className="grid gap-3">
                <div className="flex items-center">
                  <Label htmlFor="email">{t('form.email')}</Label>
                  {email.trim() && (
                    <a
                      href="#"
                      className="ml-auto text-sm underline-offset-2 hover:underline"
                      onClick={(e) => {
                        e.preventDefault()
                        setShowPasswordField(!showPasswordField)
                      }}
                    >
                      {showPasswordField ? t('form.sendLink') : t('form.loginWithPassword')}
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

              {email.trim() && showPasswordField && (
                <div className="grid gap-3">
                  <Label htmlFor="password">{t('form.password')}</Label>
                  <Input 
                    id="password" 
                    type="password" 
                    required 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              {email.trim() && (
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading 
                    ? (showPasswordField ? t('button.loggingIn') : t('button.sendingLink'))
                    : (showPasswordField ? t('button.login') : t('button.sendAuthLink'))
                  }
                </Button>
              )}

              {/* <div className="after:border-border relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
                <span className="bg-card text-muted-foreground relative z-10 px-2">
                  {t('button.continueWith')}
                </span>
              </div> */}
        
            {/* <Socials /> 
              <div className="text-center text-sm">
                {t('signup.text')}{" "}
                <a href="#" className="underline underline-offset-4">
                  {t('signup.link')}
                </a>
              </div>*/}
            </div>
          </form>
          <div className="bg-muted relative hidden md:block">
            <img
              src="/assets/factory.webp"
              alt="Image"
              className="absolute inset-0 h-full w-full object-cover dark:brightness-[0.5] dark:grayscale"
            />
          </div>
        </CardContent>
      </Card>
    
    </div>
  )
}