

// utils/iconUtils.ts
import * as TablerIcons from "@tabler/icons-react";
import { IconProps } from "./types";

export const renderIcon = (iconName?: string, props: IconProps = {}) => {
  if (!iconName) return null;
  
  const IconComponent = TablerIcons[iconName as keyof typeof TablerIcons];
  return IconComponent ? <IconComponent {...props} /> : null;
};

// components/StatCard.tsx
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CardData } from "./types";
 
interface StatCardProps {
  data: CardData;
}

export const StatCard = ({ data }: StatCardProps) => {
  const { 
    title, 
    value, 
    badge, 
    footerTitle, 
    footerIconName, 
    footerDescription 
  } = data;

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{title}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {value}
        </CardTitle>
        <CardAction>
          <Badge 
            variant="outline" 
            className={badge.className || ""}
          >
            {renderIcon(badge.iconName)}
            {badge.text}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardFooter className="flex-col items-start gap-1.5 text-sm">
        <div className="line-clamp-1 flex gap-2 font-medium">
          {footerTitle} {renderIcon(footerIconName, { className: "size-4" })}
        </div>
        <div className="text-muted-foreground">
          {footerDescription}
        </div>
      </CardFooter>
    </Card>
  );
};