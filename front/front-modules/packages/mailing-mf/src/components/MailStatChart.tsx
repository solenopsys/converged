"use client"

import * as React from "react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
 
import {
  ChartConfig,
  ChartContainer,
 
} from "converged-core"
 
interface MailStatistic {
    date: string;
    warmedMailCount: number;
    mailCount: number;
  }
  
  interface MailStatsChartProps {
    data: MailStatistic[];
  }
  
  const chartConfig = {
    mailCount: {
      label: "Regular Mails",
      color: "hsl(var(--primary))",
    },
    warmedMailCount: {
      label: "Warmed Mails", 
      color: "hsl(var(--destructive))",
    },
  } satisfies ChartConfig
  
  export function MailStatsChart({ data = [] }: MailStatsChartProps) {
    return (
      <ChartContainer config={chartConfig} className="h-[300px] w-full">
        <AreaChart data={data}>
          <CartesianGrid vertical={false} />
          <XAxis 
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tickFormatter={(value) => {
              const date = new Date(value)
              return date.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }}
          />
          <YAxis 
            tickLine={false}
            axisLine={false}
          />
          <Area
            dataKey="mailCount"
            type="natural"
            fill="#3b82f6"
            fillOpacity={0.4}
            stroke="#3b82f6"
          />
          <Area
            dataKey="warmedMailCount"
            type="natural"
            fill="#8b5cf6"
            fillOpacity={0.4}
            stroke="#8b5cf6"
          />
        </AreaChart>
      </ChartContainer>
    )
  }