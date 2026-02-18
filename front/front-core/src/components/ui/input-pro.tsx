import * as React from "react";
import { cn } from "../../lib/utils";

export interface InputProProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
}

const InputPro = React.forwardRef<HTMLInputElement, InputProProps>(
  ({ className, type, icon, ...props }, ref) => {
    return (
      <div className="group relative">
        <div
          className={cn(
            "flex items-center gap-3 overflow-hidden rounded-full border px-4 py-2.5 backdrop-blur-xl transition-all sm:gap-4 sm:px-5 sm:py-3",
            "focus-within:border-[var(--ui-accent)] focus-within:bg-[var(--ui-card)] focus-within:shadow-lg",
            "border-[var(--ui-border)]",
            className,
          )}
          style={{
            background: "color-mix(in oklch, var(--ui-card) 60%, transparent)",
          }}
        >
          {icon && (
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[var(--ui-accent)] to-[var(--ui-accent)] sm:h-12 sm:w-12">
              {icon}
            </div>
          )}

          <input
            type={type}
            className="flex-1 bg-transparent text-base text-[var(--ui-foreground)] placeholder-[var(--ui-muted-foreground)] outline-none sm:text-lg"
            ref={ref}
            {...props}
          />
        </div>
      </div>
    );
  },
);
InputPro.displayName = "InputPro";

export { InputPro };
