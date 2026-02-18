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
}: MarqueeProps) {
  const content = items || children;

  return (
    <div
      style={{ "--duration": `${durationSeconds}s` } as React.CSSProperties}
      className={cn(
        "group flex overflow-hidden p-2 [--gap:1rem] [gap:var(--gap)]",
        {
          "flex-row": !vertical,
          "flex-col": vertical,
        },
        className,
      )}
    >
      {Array(repeat)
        .fill(0)
        .map((_, i) => (
          <div
            key={i}
            className={cn("flex shrink-0 justify-around [gap:var(--gap)]", {
              "animate-marquee flex-row": !vertical,
              "animate-marquee-vertical flex-col": vertical,
              "group-hover:[animation-play-state:paused]": pauseOnHover,
              "[animation-direction:reverse]": reverse,
            })}
          >
            {content}
          </div>
        ))}
    </div>
  );
}
