import * as React from "preact/compat"
import * as tabs from "@zag-js/tabs"
import { normalizeProps, useMachine } from "@zag-js/preact"

import { cn } from "../../lib/utils"

const TabsContext = React.createContext<tabs.Api | null>(null)

function Tabs({
  className,
  value,
  defaultValue,
  onValueChange,
  children,
  ...rest
}: {
  className?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  children?: React.ReactNode
} & Record<string, unknown>) {
  const service = useMachine(tabs.machine, {
    id: React.useId(),
    value,
    defaultValue,
    onValueChange: (details) => onValueChange?.(details.value),
  })
  const api = tabs.connect(service, normalizeProps)

  return (
    <TabsContext.Provider value={api}>
      <div
        data-slot="tabs"
        className={cn("flex flex-col gap-2", className)}
        {...api.getRootProps()}
        {...(rest as any)}
      >
        {children}
      </div>
    </TabsContext.Provider>
  )
}

function useTabs() {
  const api = React.useContext(TabsContext)
  if (!api) throw new Error("Tabs.* must be used within <Tabs>")
  return api
}

function TabsList({ className, ...props }: React.ComponentProps<"div">) {
  const api = useTabs()
  return (
    <div
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px]",
        className
      )}
      {...api.getListProps()}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  value,
  disabled,
  ...props
}: React.ComponentProps<"button"> & { value: string }) {
  const api = useTabs()
  return (
    <button
      data-slot="tabs-trigger"
      className={cn(
        "data-[state=active]:bg-background dark:data-[state=active]:text-foreground text-foreground dark:text-muted-foreground inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-[color,box-shadow] disabled:pointer-events-none disabled:opacity-50 data-[state=active]:shadow-sm [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...api.getTriggerProps({ value, disabled: disabled as boolean })}
      {...props}
    />
  )
}

function TabsContent({
  className,
  value,
  ...props
}: React.ComponentProps<"div"> & { value: string }) {
  const api = useTabs()
  return (
    <div
      data-slot="tabs-content"
      className={cn("flex-1 outline-none", className)}
      {...api.getContentProps({ value })}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent }
