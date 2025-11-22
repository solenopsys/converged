import { Component } from "@solenopsys/converged-renderer";
import { cn } from "../lib/utils";

interface CardProps {
  children?: any;
  className?: string;
}

export const UiCard: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card"
      class={cn(
        "bg-card text-card-foreground flex flex-col gap-6 rounded-xl border py-6 shadow-sm",
        props.className
      )}
    >
      {props.children}
    </div>
  );
};

export const UiCardHeader: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-header"
      class={cn(
        "grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6",
        props.className
      )}
    >
      {props.children}
    </div>
  );
};

export const UiCardTitle: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-title"
      class={cn("leading-none font-semibold", props.className)}
    >
      {props.children}
    </div>
  );
};

export const UiCardDescription: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-description"
      class={cn("text-muted-foreground text-sm", props.className)}
    >
      {props.children}
    </div>
  );
};

export const UiCardAction: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-action"
      class={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        props.className
      )}
    >
      {props.children}
    </div>
  );
};

export const UiCardContent: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-content"
      class={cn("px-6", props.className)}
    >
      {props.children}
    </div>
  );
};

export const UiCardFooter: Component<CardProps> = (props) => {
  return () => () => (
    <div
      data-slot="card-footer"
      class={cn("flex items-center px-6", props.className)}
    >
      {props.children}
    </div>
  );
};
