import { createStore, createEvent, sample } from "effector";

export type TooltipState = "closed" | "opening" | "open" | "closing";
export type TooltipEvent =
  | "POINTER_ENTER"
  | "POINTER_LEAVE"
  | "OPEN_DELAY"
  | "CLOSE_DELAY"
  | "FOCUS"
  | "BLUR";

// State transition map - pure configuration
const transitions: Record<
  TooltipState,
  Partial<Record<TooltipEvent, TooltipState>>
> = {
  closed: {
    POINTER_ENTER: "opening",
    FOCUS: "opening",
  },
  opening: {
    POINTER_LEAVE: "closed",
    BLUR: "closed",
    OPEN_DELAY: "open",
  },
  open: {
    POINTER_LEAVE: "closing",
    BLUR: "closing",
  },
  closing: {
    POINTER_ENTER: "open",
    FOCUS: "open",
    CLOSE_DELAY: "closed",
  },
};

export function createTooltipMachine() {
  const $state = createStore<TooltipState>("closed");
  const send = createEvent<TooltipEvent>();

  sample({
    clock: send,
    source: $state,
    fn: (state, event) => {
      return transitions[state]?.[event] ?? state;
    },
    target: $state,
  });

  return {
    $state,
    send,
  };
}
