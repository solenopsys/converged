import { createElement, Fragment, type ComponentChildren } from "preact";
import { useMemo } from "preact/hooks";

type MotionProps = Record<string, any> & { children?: ComponentChildren };

const makeMotionTag = (tag: string) => {
  return ({ children, ...rest }: MotionProps) => createElement(tag, rest, children);
};

export const motion = new Proxy(
  {},
  {
    get: (_, tag: string) => makeMotionTag(tag),
  },
) as Record<string, (props: MotionProps) => any>;

export function AnimatePresence({ children }: { children?: ComponentChildren }) {
  return createElement(Fragment, null, children);
}

export function usePresence(): [boolean, () => void] {
  return [true, () => {}];
}

export function useIsPresent(): boolean {
  return true;
}

type MotionValue = {
  get: () => number;
  set: (next: number) => void;
  on: (event: "change", cb: (latest: number) => void) => () => void;
};

export function useMotionValue(initial: number): MotionValue {
  return useMemo(() => {
    let current = initial;
    const listeners = new Set<(latest: number) => void>();
    return {
      get: () => current,
      set: (next: number) => {
        current = next;
        listeners.forEach((cb) => cb(current));
      },
      on: (_event: "change", cb: (latest: number) => void) => {
        listeners.add(cb);
        cb(current);
        return () => listeners.delete(cb);
      },
    };
  }, [initial]);
}

export function useSpring(value: MotionValue, _config?: unknown): MotionValue {
  return value;
}

export function useInView(_ref: unknown, _options?: unknown): boolean {
  return true;
}
