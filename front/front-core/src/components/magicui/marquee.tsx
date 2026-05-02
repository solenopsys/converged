import { cn } from "../../lib/utils";

interface MarqueeProps {
  className?: string;
  reverse?: boolean;
  pauseOnHover?: boolean;
  children?: React.ReactNode;
  items?: React.ReactNode[];
  vertical?: boolean;
  repeat?: number;
  durationSeconds?: number;
  gap?: string;
}

export function Marquee({
  className,
  reverse,
  pauseOnHover = false,
  children,
  items,
  vertical = false,
  repeat = 4,
  durationSeconds = 40,
  gap = "1rem",
}: MarqueeProps) {
  const content = items || children;

  return (
    <div
      style={{
        "--duration": `${durationSeconds}s`,
        "--gap": gap,
        gap: "var(--gap)",
      } as React.CSSProperties}
      className={cn(
        "group flex overflow-hidden p-2",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
          "marquee-pause-on-hover": pauseOnHover,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            style={{
              gap: "var(--gap)",
              animation: `${vertical ? "marquee-vertical" : "marquee"} var(--duration) linear infinite`,
              animationDirection: reverse ? "reverse" : undefined,
            }}
            className={cn("marquee-content flex shrink-0 justify-around", {
              "flex-row": !vertical,
              "flex-col": vertical,
            })}
          >
            {content}
          </div>
        ))}
    </div>
  );
}
