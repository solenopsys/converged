import { cn } from "@/lib/utils"

type SeparatorProps = JSX.HTMLAttributes<HTMLDivElement> & {
  orientation?: "horizontal" | "vertical"
  decorative?: boolean
}

function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  role,
  ...props
}: SeparatorProps) {
  const ariaOrientation = orientation === "vertical" ? "vertical" : "horizontal"
  const separatorRole = decorative ? undefined : role ?? "separator"

  return (
    <div
      data-slot="separator-root"
      role={separatorRole}
      aria-orientation={separatorRole ? ariaOrientation : undefined}
      className={cn(
        "bg-border shrink-0",
        ariaOrientation === "horizontal"
          ? "h-px w-full"
          : "h-full w-px",
        className
      )}
      {...props}
    />
  )
}

export { Separator }
