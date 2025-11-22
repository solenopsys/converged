"use client";

import { createContext, useContext } from "@solenopsys/converged-renderer";
import { observable } from "@solenopsys/converged-reactive";

import { cn } from "@/lib/utils";

type CollapsibleContextValue = {
  open: () => boolean;
  setOpen: (open: boolean) => void;
};

const CollapsibleContext = createContext<CollapsibleContextValue | null>(null);

type CollapsibleProps = JSX.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function Collapsible({
  className,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  ...props
}: CollapsibleProps) {
  const internalOpen = observable(defaultOpen);
  const isControlled = open !== undefined;

  const current = () => (isControlled ? !!open : internalOpen());
  const setOpen = (next: boolean) => {
    if (!isControlled) {
      internalOpen(next);
    }
    onOpenChange?.(next);
  };

  return (
    <CollapsibleContext.Provider value={{ open: current, setOpen }}>
      <div
        data-slot="collapsible"
        data-state={current() ? "open" : "closed"}
        className={cn(className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  );
}

type CollapsibleTriggerProps = JSX.ButtonHTMLAttributes<HTMLButtonElement>;

function CollapsibleTrigger({
  className,
  children,
  ...props
}: CollapsibleTriggerProps) {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleTrigger must be used within <Collapsible>");
  }

  const handleClick = (event: MouseEvent & { currentTarget: HTMLButtonElement }) => {
    context.setOpen(!context.open());
    props.onClick?.(event as never);
  };

  const state = context.open() ? "open" : "closed";

  return (
    <button
      type="button"
      aria-expanded={context.open()}
      data-slot="collapsible-trigger"
      data-state={state}
      className={className}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
}

type CollapsibleContentProps = JSX.HTMLAttributes<HTMLDivElement>;

function CollapsibleContent({
  className,
  children,
  ...props
}: CollapsibleContentProps) {
  const context = useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleContent must be used within <Collapsible>");
  }

  const open = context.open();

  return (
    <div
      data-slot="collapsible-content"
      data-state={open ? "open" : "closed"}
      hidden={!open}
      className={cn(className)}
      {...props}
    >
      {children}
    </div>
  );
}

export { Collapsible, CollapsibleTrigger, CollapsibleContent };
