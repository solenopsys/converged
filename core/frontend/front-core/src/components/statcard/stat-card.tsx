import { getIconByName } from "../../icons";
import { Badge } from "../ui/badge";
import { Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle } from "../ui/card";
import type { CardData, IconProps } from "./types";

export const renderIcon = (iconName?: string, props: IconProps = {}) => {
	if (!iconName) return null;

	const IconComponent = getIconByName(iconName);
	return IconComponent ? <IconComponent {...props} /> : null;
};

interface StatCardProps {
	data: CardData;
}

export const StatCard = ({ data }: StatCardProps) => {
	const { title, value, badge, footerTitle, footerIconName, footerDescription } = data;

	return (
		<Card className="@container/card">
			<CardHeader>
				<CardDescription>{title}</CardDescription>
				<CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">{value}</CardTitle>
				<CardAction>
					<Badge variant="outline" className={badge.className || ""}>
						{renderIcon(badge.iconName)}
						{badge.text}
					</Badge>
				</CardAction>
			</CardHeader>
			<CardFooter className="flex-col items-start gap-1.5 text-sm">
				<div className="line-clamp-1 flex gap-2 font-medium">
					{footerTitle} {renderIcon(footerIconName, { className: "size-4" })}
				</div>
				<div className="text-muted-foreground">{footerDescription}</div>
			</CardFooter>
		</Card>
	);
};
