import { type Component } from "@solenopsys/converged-renderer";
import { cn } from "../lib/utils";

interface InputProps {
  type?: string;
  placeholder?: string;
  value?: string;
  disabled?: boolean;
  className?: string;
  onInput?: (e: Event) => void;
  onChange?: (e: Event) => void;
}

export const UiInput: Component<InputProps> = (props) => {
  return () => () => (
    <input
      type={props.type || "text"}
      data-slot="input"
      placeholder={props.placeholder}
      value={props.value}
      disabled={props.disabled}
      onInput={props.onInput}
      onChange={props.onChange}
      class={cn(
        "placeholder:text-muted-foreground h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base transition-all outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-3",
        props.className,
      )}
    />
  );
};

export default UiInput;
