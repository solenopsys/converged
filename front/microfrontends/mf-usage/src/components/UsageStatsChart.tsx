import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  ChartConfig,
  ChartContainer,
} from "front-core";

interface UsageDailyStatsItem {
  date: string;
  total: number;
}

interface UsageStatsChartProps {
  data: UsageDailyStatsItem[];
  title?: string;
  description?: string;
}

const chartConfig = {
  total: {
    label: "Usage",
    color: "hsl(var(--primary))",
  },
} satisfies ChartConfig;

export function UsageStatsChart({ data = [], title, description }: UsageStatsChartProps) {
  return (
    <Card className="flex h-full flex-col gap-4 py-4">
      {(title || description) && (
        <CardHeader className="shrink-0 px-4 pb-2">
          {title && <CardDescription>{title}</CardDescription>}
          {description && (
            <div className="text-xs text-muted-foreground">{description}</div>
          )}
        </CardHeader>
      )}
      <CardContent className="flex min-h-0 flex-1 px-4 pb-4 pt-0">
        <ChartContainer
          config={chartConfig}
          aspect="none"
          className="flex-1 min-h-[160px] w-full"
        >
          <AreaChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 20 }}>
            <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.35} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => {
                const date = new Date(value);
                return date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                });
              }}
            />
            <YAxis tickLine={false} axisLine={false} />
            <Area
              dataKey="total"
              type="natural"
              fill="#3b82f6"
              fillOpacity={0.3}
              stroke="#3b82f6"
              strokeOpacity={0.85}
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
