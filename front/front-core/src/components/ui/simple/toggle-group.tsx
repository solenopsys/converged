"use client";

import { createContext, useContext } from "@solenopsys/converged-renderer";
import { observable } from "@solenopsys/converged-reactive";
import { type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { toggleVariants } from "@/components/ui/toggle";

type ToggleGroupValue = string | string[] | null;

type ToggleGroupContextValue = {
  type: "single" | "multiple";
  isPressed: (value: string) => boolean;
  toggleValue: (value: string) => void;
  variant?: VariantProps<typeof toggleVariants>["variant"];
  size?: VariantProps<typeof toggleVariants>["size"];
};

const ToggleGroupContext = createContext<ToggleGroupContextValue | null>(null);

type ToggleGroupProps = JSX.HTMLAttributes<HTMLDivElement> &
  VariantProps<typeof toggleVariants> & {
    type?: "single" | "multiple";
    value?: ToggleGroupValue;
    defaultValue?: ToggleGroupValue;
    onValueChange?: (value: ToggleGroupValue) => void;
  };

function ToggleGroup({
  className,
  variant,
  size,
  type = "single",
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: ToggleGroupProps) {
  const initial =
    defaultValue ??
    (type === "multiple"
      ? ([] as string[])
      : (null as string | null));
  const internalValue = observable<ToggleGroupValue>(initial);
  const isControlled = value !== undefined;

  const currentValue = () =>
    isControlled ? value! : internalValue();

  const setValue = (next: ToggleGroupValue) => {
    if (!isControlled) {
      internalValue(next);
    }
    onValueChange?.(next);
  };

  const contextValue: ToggleGroupContextValue = {
    type,
    variant,
    size,
    isPressed(itemValue) {
      const current = currentValue();
      return type === "multiple"
        ? Array.isArray(current) && current.includes(itemValue)
        : current === itemValue;
    },
    toggleValue(itemValue) {
      if (type === "multiple") {
        const current = Array.isArray(currentValue())
          ? [...(currentValue() as string[])]
          : [];
        const index = current.indexOf(itemValue);
        if (index >= 0) {
          current.splice(index, 1);
        } else {
          current.push(itemValue);
        }
        setValue(current);
      } else {
        const current = currentValue();
        const next = current === itemValue ? null : itemValue;
        setValue(next);
      }
    },
  };

  return (
    <div
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex w-fit items-center rounded-md data-[variant=outline]:shadow-xs",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={contextValue}>
        {children}
      </ToggleGroupContext.Provider>
    </div>
  );
}

type ToggleGroupItemProps = JSX.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof toggleVariants> & {
    value: string;
  };

function ToggleGroupItem({
  className,
  children,
  value,
  variant,
  size,
  disabled,
  ...props
}: ToggleGroupItemProps) {
  const context = useContext(ToggleGroupContext);
  if (!context) {
    throw new Error(
      "ToggleGroupItem must be used within a ToggleGroup",
    );
  }

  const pressed = context.isPressed(value);
  const resolvedVariant = context.variant || variant;
  const resolvedSize = context.size || size;

  const handleClick = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    if (disabled) return;
    context.toggleValue(value);
    props.onClick?.(event as never);
  };

  return (
    <button
      type="button"
      role="button"
      aria-pressed={pressed}
      data-slot="toggle-group-item"
      data-variant={resolvedVariant}
      data-size={resolvedSize}
      data-state={pressed ? "on" : "off"}
      className={cn(
        toggleVariants({
          variant: resolvedVariant,
          size: resolvedSize,
        }),
        "min-w-0 flex-1 shrink-0 rounded-none shadow-none first:rounded-l-md last:rounded-r-md focus:z-10 focus-visible:z-10 data-[variant=outline]:border-l-0 data-[variant=outline]:first:border-l",
        className,
      )}
      disabled={disabled}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

export { ToggleGroup, ToggleGroupItem };
