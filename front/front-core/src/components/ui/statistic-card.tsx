import * as React from "react";
import { cn } from "../../lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./card";

type TrendDirection = "up" | "down" | "neutral";

export interface StatisticCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  trend?: {
    value: string;
    label?: string;
    direction?: TrendDirection;
  };
  className?: string;
}

const trendClasses: Record<TrendDirection, string> = {
  up: "text-emerald-600",
  down: "text-rose-600",
  neutral: "text-muted-foreground",
};

export function StatisticCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
}: StatisticCardProps) {
  const trendClass =
    trend?.direction ? trendClasses[trend.direction] : "text-muted-foreground";

  return (
    <Card className={cn("bg-gradient-to-br from-background to-muted/20", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardDescription className="text-xs uppercase tracking-wide">
            {title}
          </CardDescription>
          <CardTitle className="text-3xl font-semibold tabular-nums">
            {value}
          </CardTitle>
        </div>
        {Icon && (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Icon className="h-5 w-5" />
          </div>
        )}
      </CardHeader>
      {(description || trend) && (
        <CardContent className="pt-1">
          {trend && (
            <div className={cn("text-xs font-medium", trendClass)}>
              {trend.value}
              {trend.label ? ` ${trend.label}` : ""}
            </div>
          )}
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
