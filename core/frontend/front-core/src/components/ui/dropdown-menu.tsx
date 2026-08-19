import * as React from "preact/compat"
import * as menu from "@zag-js/menu"
import { normalizeProps, Portal, useMachine } from "@zag-js/preact"
import { CheckIcon, ChevronRightIcon, CircleIcon } from "../../icons"

import { cn } from "../../lib/utils"
import { Slot } from "./slot"

const DropdownMenuContext = React.createContext<menu.Api | null>(null)

function DropdownMenu({
  children,
  open,
  onOpenChange,
  ...rest
}: {
  children?: React.ReactNode
  open?: boolean
  onOpenChange?: (open: boolean) => void
} & Record<string, unknown>) {
  const service = useMachine(menu.machine, {
    id: React.useId(),
    open,
    onOpenChange: (details) => onOpenChange?.(details.open),
  })
  const api = menu.connect(service, normalizeProps)

  return <DropdownMenuContext.Provider value={api}>{children}</DropdownMenuContext.Provider>
}

function useDropdownMenu() {
  const api = React.useContext(DropdownMenuContext)
  if (!api) throw new Error("DropdownMenu.* must be used within <DropdownMenu>")
  return api
}

function DropdownMenuPortal({ children }: { children?: React.ReactNode }) {
  return <Portal>{children}</Portal>
}

function DropdownMenuTrigger({
  asChild,
  ...props
}: React.ComponentProps<"button"> & { asChild?: boolean }) {
  const api = useDropdownMenu()
  const Comp = asChild ? Slot : "button"
  return <Comp data-slot="dropdown-menu-trigger" {...api.getTriggerProps()} {...props} />
}

function DropdownMenuContent({
  className,
  ...props
}: React.ComponentProps<"div"> & { align?: "start" | "end" | "center" }) {
  const api = useDropdownMenu()
  if (!api.open) return null
  return (
    <DropdownMenuPortal>
      <div {...api.getPositionerProps()}>
        <div
          data-slot="dropdown-menu-content"
          className={cn(
            "bg-popover text-popover-foreground z-50 min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md",
            className
          )}
          {...api.getContentProps()}
          {...props}
        />
      </div>
    </DropdownMenuPortal>
  )
}

function DropdownMenuGroup({ ...props }: React.ComponentProps<"div">) {
  return <div data-slot="dropdown-menu-group" role="group" {...props} />
}

function DropdownMenuItem({
  className,
  inset,
  variant = "default",
  value,
  disabled,
  ...props
}: React.ComponentProps<"div"> & {
  inset?: boolean
  variant?: "default" | "destructive"
  value?: string
  disabled?: boolean
}) {
  const api = useDropdownMenu()
  const autoId = React.useId()
  return (
    <div
      data-slot="dropdown-menu-item"
      data-inset={inset}
      data-variant={variant}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...api.getItemProps({ value: value ?? autoId, disabled })}
      {...props}
    />
  )
}

function DropdownMenuCheckboxItem({
  className,
  children,
  checked,
  onCheckedChange,
  value,
  ...props
}: React.ComponentProps<"div"> & {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  value?: string
}) {
  const api = useDropdownMenu()
  const autoId = React.useId()
  const itemValue = value ?? autoId
  return (
    <div
      data-slot="dropdown-menu-checkbox-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...api.getOptionItemProps({ type: "checkbox", value: itemValue, checked })}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CheckIcon className="size-4" />}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuRadioGroup({
  children,
  value,
  onValueChange,
}: {
  children?: React.ReactNode
  value?: string
  onValueChange?: (value: string) => void
}) {
  return (
    <div data-slot="dropdown-menu-radio-group" role="group" data-value={value}>
      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child as any, {
          __radioValue: value,
          __radioOnChange: onValueChange,
        })
      })}
    </div>
  )
}

function DropdownMenuRadioItem({
  className,
  children,
  value,
  __radioValue,
  __radioOnChange,
  ...props
}: React.ComponentProps<"div"> & {
  value: string
  __radioValue?: string
  __radioOnChange?: (value: string) => void
}) {
  const api = useDropdownMenu()
  const checked = __radioValue === value
  return (
    <div
      data-slot="dropdown-menu-radio-item"
      className={cn(
        "focus:bg-accent focus:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...api.getOptionItemProps({ type: "radio", value, checked })}
      onClick={() => __radioOnChange?.(value)}
      {...props}
    >
      <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
        {checked && <CircleIcon className="size-2 fill-current" />}
      </span>
      {children}
    </div>
  )
}

function DropdownMenuLabel({
  className,
  inset,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  return (
    <div
      data-slot="dropdown-menu-label"
      data-inset={inset}
      className={cn("px-2 py-1.5 text-sm font-medium data-[inset]:pl-8", className)}
      {...props}
    />
  )
}

function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<"div">) {
  const api = useDropdownMenu()
  return (
    <div
      data-slot="dropdown-menu-separator"
      className={cn("bg-border -mx-1 my-1 h-px", className)}
      {...api.getSeparatorProps()}
      {...props}
    />
  )
}

function DropdownMenuShortcut({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn("text-muted-foreground ml-auto text-xs tracking-widest", className)}
      {...props}
    />
  )
}

// Rough: submenus render as an independent nested DropdownMenu rather than a
// true zag parent/child menu chain.
function DropdownMenuSub({ children }: { children?: React.ReactNode }) {
  return <DropdownMenu>{children}</DropdownMenu>
}

function DropdownMenuSubTrigger({
  className,
  inset,
  children,
  ...props
}: React.ComponentProps<"div"> & { inset?: boolean }) {
  const api = useDropdownMenu()
  return (
    <div
      data-slot="dropdown-menu-sub-trigger"
      data-inset={inset}
      className={cn(
        "focus:bg-accent focus:text-accent-foreground flex cursor-default items-center rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8",
        className
      )}
      onClick={() => api.setOpen(!api.open)}
      {...props}
    >
      {children}
      <ChevronRightIcon className="ml-auto size-4" />
    </div>
  )
}

function DropdownMenuSubContent({ className, ...props }: React.ComponentProps<"div">) {
  return <DropdownMenuContent className={className} {...props} />
}

export {
  DropdownMenu,
  DropdownMenuPortal,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
}
