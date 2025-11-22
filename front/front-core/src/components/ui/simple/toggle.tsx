"use client";

import { observable } from "@solenopsys/converged-reactive";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const toggleVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium hover:bg-muted hover:text-muted-foreground disabled:pointer-events-none disabled:opacity-50 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 [&_svg]:shrink-0 focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none transition-[color,box-shadow] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-transparent",
        outline:
          "border border-input bg-transparent shadow-xs hover:bg-accent hover:text-accent-foreground",
      },
      size: {
        default: "h-9 px-2 min-w-9",
        sm: "h-8 px-1.5 min-w-8",
        lg: "h-10 px-2.5 min-w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ToggleProps = Omit<
  JSX.ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange"
> &
  VariantProps<typeof toggleVariants> & {
    pressed?: boolean;
    defaultPressed?: boolean;
    onPressedChange?: (pressed: boolean) => void;
  };

function Toggle({
  className,
  variant,
  size,
  pressed,
  defaultPressed = false,
  onPressedChange,
  onClick,
  disabled,
  ...props
}: ToggleProps) {
  const internalPressed = observable(defaultPressed);
  const isControlled = pressed !== undefined;
  const current = () => (isControlled ? !!pressed : internalPressed());

  const setPressed = (next: boolean) => {
    if (!isControlled) {
      internalPressed(next);
    }
    onPressedChange?.(next);
  };

  const handleClick = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    if (disabled) return;
    const next = !current();
    setPressed(next);
    onClick?.(event as never);
  };

  return (
    <button
      type="button"
      role="button"
      aria-pressed={current()}
      disabled={disabled}
      data-slot="toggle"
      data-state={current() ? "on" : "off"}
      onClick={handleClick}
      className={cn(toggleVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
