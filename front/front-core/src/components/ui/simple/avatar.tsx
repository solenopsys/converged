"use client";

import { createContext, useContext } from "@solenopsys/converged-renderer";
import { observable } from "@solenopsys/converged-reactive";

import { cn } from "@/lib/utils";

type AvatarContextValue = {
  imageLoaded: ReturnType<typeof observable<boolean>>;
};

const AvatarContext = createContext<AvatarContextValue | null>(null);

type AvatarProps = JSX.HTMLAttributes<HTMLDivElement>;

function Avatar({ className, children, ...props }: AvatarProps) {
  const imageLoaded = observable(false);

  return (
    <AvatarContext.Provider value={{ imageLoaded }}>
      <div
        data-slot="avatar"
        className={cn(
          "relative flex size-8 shrink-0 overflow-hidden rounded-full",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </AvatarContext.Provider>
  );
}

type AvatarImageProps = JSX.ImgHTMLAttributes<HTMLImageElement>;

function AvatarImage({ className, onLoad, onError, ...props }: AvatarImageProps) {
  const context = useContext(AvatarContext);

  const handleLoad = (event: any) => {
    context?.imageLoaded(true);
    onLoad?.(event);
  };

  const handleError = (event: any) => {
    context?.imageLoaded(false);
    onError?.(event);
  };

  return (
    <img
      data-slot="avatar-image"
      className={cn("aspect-square size-full", className)}
      onLoad={handleLoad}
      onError={handleError}
      {...props}
    />
  );
}

type AvatarFallbackProps = JSX.HTMLAttributes<HTMLDivElement>;

function AvatarFallback({ className, ...props }: AvatarFallbackProps) {
  const context = useContext(AvatarContext);
  const hidden = context?.imageLoaded();

  return (
    <div
      data-slot="avatar-fallback"
      aria-hidden={hidden ? "true" : "false"}
      className={cn(
        "bg-muted flex size-full items-center justify-center rounded-full",
        hidden ? "hidden" : "",
        className,
      )}
      {...props}
    />
  );
}

export { Avatar, AvatarImage, AvatarFallback };
