import * as React from "preact/compat"

// Rough replacement for @radix-ui/react-slot: merges className/style/ref/handlers
// of the single child element with the props passed to <Slot>.
export function Slot({
  children,
  ...slotProps
}: Record<string, any> & { children?: React.ReactNode }) {
  if (!React.isValidElement(children)) return children ?? null

  const childProps = (children as any).props as Record<string, any>
  const merged: Record<string, any> = { ...childProps, ...slotProps }

  if (childProps.className || (slotProps as any).className) {
    merged.className = [childProps.className, (slotProps as any).className]
      .filter(Boolean)
      .join(" ")
  }
  if (childProps.style || (slotProps as any).style) {
    merged.style = { ...(childProps.style ?? {}), ...((slotProps as any).style ?? {}) }
  }

  for (const key of Object.keys(slotProps)) {
    if (key.startsWith("on") && typeof (slotProps as any)[key] === "function" && typeof childProps[key] === "function") {
      const slotHandler = (slotProps as any)[key]
      const childHandler = childProps[key]
      merged[key] = (...args: any[]) => {
        childHandler(...args)
        slotHandler(...args)
      }
    }
  }

  return React.cloneElement(children as any, merged)
}
