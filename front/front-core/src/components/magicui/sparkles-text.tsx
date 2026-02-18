"use client";

import { useEffect, useState } from "react";
import { cn } from "../../lib/utils";

interface Sparkle {
  id: string;
  x: string;
  y: string;
  color: string;
  delay: number;
  scale: number;
  lifespan: number;
}

interface SparklesTextProps {
  children: React.ReactNode;
  className?: string;
  sparklesCount?: number;
  colors?: {
    first: string;
    second: string;
  };
}

const generateSparkle = (colors: { first: string; second: string }): Sparkle => {
  return {
    id: Math.random().toString(36).slice(2),
    x: `${Math.random() * 100}%`,
    y: `${Math.random() * 100}%`,
    color: Math.random() > 0.5 ? colors.first : colors.second,
    delay: Math.random() * 2,
    scale: Math.random() * 1 + 0.3,
    lifespan: Math.random() * 10 + 5,
  };
};

const Sparkle = ({ sparkle }: { sparkle: Sparkle }) => {
  return (
    <span
      className="pointer-events-none absolute z-20 animate-sparkle-spin"
      style={{
        left: sparkle.x,
        top: sparkle.y,
        animationDelay: `${sparkle.delay}s`,
        animationDuration: `${sparkle.lifespan}s`,
      }}
    >
      <svg
        className="animate-sparkle-fade"
        style={{
          animationDelay: `${sparkle.delay}s`,
          animationDuration: `${sparkle.lifespan}s`,
          transform: `scale(${sparkle.scale})`,
        }}
        width="21"
        height="21"
        viewBox="0 0 21 21"
        fill="none"
      >
        <path
          d="M10.5 0L13.09 7.91L21 10.5L13.09 13.09L10.5 21L7.91 13.09L0 10.5L7.91 7.91L10.5 0Z"
          fill={sparkle.color}
        />
      </svg>
    </span>
  );
};

export function SparklesText({
  children,
  className,
  sparklesCount = 10,
  colors = { first: "#9E7AFF", second: "#FE8BBB" },
}: SparklesTextProps) {
  const [sparkles, setSparkles] = useState<Sparkle[]>([]);

  useEffect(() => {
    const initialSparkles = Array.from({ length: sparklesCount }, () =>
      generateSparkle(colors)
    );
    setSparkles(initialSparkles);

    const interval = setInterval(() => {
      setSparkles((currentSparkles) =>
        currentSparkles.map((sparkle) =>
          Math.random() > 0.7 ? generateSparkle(colors) : sparkle
        )
      );
    }, 3000);

    return () => clearInterval(interval);
  }, [sparklesCount, colors]);

  return (
    <span className={cn("relative inline-block", className)}>
      {sparkles.map((sparkle) => (
        <Sparkle key={sparkle.id} sparkle={sparkle} />
      ))}
      <span className="relative z-10">{children}</span>
    </span>
  );
}
