import { Component } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";
import { EffectFunction } from "@solenopsys/converged-reactive";
import { cn } from "../lib/utils";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "destructive"
  | "outline";
type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 shrink-0 whitespace-nowrap rounded-md font-medium transition-all duration-150 disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-ring/50 focus-visible:ring-3";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-primary text-primary-foreground hover:brightness-110",
  secondary: "bg-secondary text-secondary-foreground hover:brightness-95",
  ghost: "bg-transparent hover:bg-accent hover:text-accent-foreground",
  destructive:
    "bg-destructive text-destructive-foreground hover:brightness-110",
  outline: "border bg-background hover:bg-accent hover:text-accent-foreground",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-9 px-4 text-sm",
  lg: "h-10 px-6 text-sm",
};

interface UiButtonProps {
  children?: any;
  title?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  onClick?: EffectFunction;
  type?: "button" | "submit" | "reset";
}

export const UiButton: Component<UiButtonProps> = (props) => {
  const title = $(props.title || props.children || "");

  $.effect(() => console.log("Button title:", title()));

  return () => {
    const handleClick = () => {
      if (props.onClick) {
        props.onClick();
      }
    };

    return () => (
      <button
        type={props.type || "button"}
        disabled={props.disabled}
        onClick={handleClick}
        class={cn(
          base,
          variants[props.variant || "primary"],
          sizes[props.size || "md"],
          props.className,
        )}
        title={title()}
      >
        {title()}
      </button>
    );
  };
};

export default UiButton;
