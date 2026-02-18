import * as React from "react";

import { cn } from "../../lib/utils";

interface ShineBorderProps extends React.HTMLAttributes<HTMLDivElement> {
  borderWidth?: number;
  borderRadius?: string;
  children: React.ReactNode;
}

// Animated conic-gradient border that stays calm at rest and lights up on hover.
// Border width/radius are configurable to keep the effect reusable.
const ShineBorder: React.FC<ShineBorderProps> = ({
  borderWidth = 1.5,
  borderRadius = "1.5rem",
  className,
  children,
  ...props
}) => {
  const radiusValue = borderRadius;
  const innerRadius = `calc(${radiusValue} - ${borderWidth * 2}px)`;

  return (
    <div
      className={cn("group relative isolate overflow-hidden", className)}
      style={{ borderRadius: radiusValue, padding: borderWidth }}
      {...props}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-0 transition-opacity duration-700 group-hover:opacity-100 group-hover:animate-[spin_8s_linear_infinite]"
        style={{
          padding: borderWidth,
          borderRadius: radiusValue,
          background:
            "conic-gradient(from 180deg at 50% 50%, rgba(56,189,248,0.8), rgba(168,85,247,0.9), rgba(248,113,113,0.9), rgba(56,189,248,0.8))",
          mask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
        }}
      />

      <div
        className="relative z-10 h-full w-full backdrop-blur-xl transition-colors duration-500"
        style={{
          borderRadius: innerRadius,
          backgroundColor:
            "color-mix(in oklch, var(--ui-card) 85%, transparent)",
        }}
      >
        {children}
      </div>
    </div>
  );
};

export { ShineBorder };
