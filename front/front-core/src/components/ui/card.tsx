import { Pin } from "lucide-react";
import * as React from "react";

import { cn } from "../../lib/utils";
import { dashboardSlots, subscribeDashboardIndicators } from "../../slots";
import { useDashboardPinScope } from "../dashboard/DashboardPinScope";
import { DashboardWidget } from "../dashboard/DashboardWidget";

export type DashboardPinMeta = {
	id?: string;
	title?: string;
	source?: string;
	componentKey?: string;
	position?: number;
	enabled?: boolean;
	buttonClassName?: string;
	pinnedClassName?: string;
};

type CardProps = React.ComponentProps<"div"> & {
	dashboardPin?: DashboardPinMeta | false;
	pinnable?: boolean;
};

function BaseCard({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card"
			className={cn(
				"relative bg-card text-card-foreground flex flex-col rounded-xl border py-4 shadow-sm overflow-hidden h-full",
				className,
			)}
			{...props}
		/>
	);
}

type ResolvedDashboardPin = Required<Pick<DashboardPinMeta, "id">> &
	Omit<DashboardPinMeta, "id">;

function useResolvedDashboardPin(
	dashboardPin: DashboardPinMeta | false | undefined,
	pinnable: boolean | undefined,
): ResolvedDashboardPin | null {
	const scope = useDashboardPinScope();

	if (dashboardPin === false) return null;
	if (dashboardPin?.enabled === false) return null;
	if (pinnable === false) return null;

	const explicitId = dashboardPin?.id?.trim();
	if (explicitId) {
		return {
			...dashboardPin,
			id: explicitId,
			source: dashboardPin.source ?? scope.scopeId,
			componentKey: dashboardPin.componentKey ?? explicitId,
		};
	}

	const explicitComponentKey = dashboardPin?.componentKey?.trim();
	if (explicitComponentKey) {
		return {
			...dashboardPin,
			id: explicitComponentKey,
			source: dashboardPin.source ?? scope.scopeId,
			componentKey: explicitComponentKey,
		};
	}

	if (!scope.enabled) return null;

	return null;
}

export type DashboardPinnableCardProps = React.ComponentProps<"div"> & {
	dashboardPin: ResolvedDashboardPin;
};

function DashboardPinnableCard({
	className,
	dashboardPin,
	children,
	...props
}: DashboardPinnableCardProps) {
	const pinId = dashboardPin.id;
	const [pinned, setPinned] = React.useState(() =>
		dashboardSlots.isPinned(pinId),
	);

	const pinnedContent = (
		<DashboardWidget className={cn("min-h-40", dashboardPin?.pinnedClassName)}>
			<BaseCard className={className} {...props}>
				{children}
			</BaseCard>
		</DashboardWidget>
	);
	const pinnedContentRef = React.useRef(pinnedContent);
	pinnedContentRef.current = pinnedContent;

	React.useEffect(() => {
		let disposed = false;
		dashboardSlots.register(pinId, pinnedContentRef.current, {
			title: dashboardPin.title,
			source: dashboardPin.source,
			componentKey: dashboardPin.componentKey,
			position: dashboardPin.position,
		});
		setPinned(dashboardSlots.isPinned(pinId));
		void dashboardSlots.loadIndicators().then(() => {
			if (!disposed) {
				setPinned(dashboardSlots.isPinned(pinId));
			}
		});
		const unsubscribe = subscribeDashboardIndicators(() => {
			setPinned(dashboardSlots.isPinned(pinId));
		});
		return () => {
			disposed = true;
			unsubscribe();
		};
	}, [
		pinId,
		dashboardPin.title,
		dashboardPin.source,
		dashboardPin.componentKey,
		dashboardPin.position,
	]);

	const pinToIndicators = (event: React.MouseEvent<HTMLButtonElement>) => {
		event.preventDefault();
		event.stopPropagation();
		dashboardSlots.pin(pinId, pinnedContentRef.current, {
			title: dashboardPin.title,
			source: dashboardPin.source,
			componentKey: dashboardPin.componentKey,
			position: dashboardPin.position,
		});
		setPinned(true);
	};

	return (
		<BaseCard className={className} {...props}>
			{children}
			<button
				aria-label={`Pin ${dashboardPin?.title ?? "card"} to indicators`}
				aria-pressed={pinned}
				className={cn(
					"absolute bottom-2 right-2 z-20 inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background/85 text-muted-foreground shadow-sm backdrop-blur transition",
					"opacity-75 hover:bg-accent hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
					pinned && "text-foreground opacity-100",
					dashboardPin?.buttonClassName,
				)}
				onClick={pinToIndicators}
				title={pinned ? "Pinned to indicators" : "Pin to indicators"}
				type="button"
			>
				<Pin aria-hidden="true" className="h-3.5 w-3.5" />
			</button>
		</BaseCard>
	);
}

function Card({
	className,
	dashboardPin,
	pinnable,
	children,
	...props
}: CardProps) {
	const resolvedPin = useResolvedDashboardPin(dashboardPin, pinnable);

	if (!resolvedPin) {
		return (
			<BaseCard className={className} {...props}>
				{children}
			</BaseCard>
		);
	}

	return (
		<DashboardPinnableCard
			className={className}
			dashboardPin={resolvedPin}
			{...props}
		>
			{children}
		</DashboardPinnableCard>
	);
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-header"
			className={cn(
				"@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-1 px-4 has-data-[slot=card-action]:grid-cols-[1fr_auto] [.border-b]:pb-4 shrink-0",
				className,
			)}
			{...props}
		/>
	);
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-title"
			className={cn("leading-none font-semibold", className)}
			{...props}
		/>
	);
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-description"
			className={cn("text-muted-foreground text-sm", className)}
			{...props}
		/>
	);
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-action"
			className={cn(
				"col-start-2 row-span-2 row-start-1 self-start justify-self-end",
				className,
			)}
			{...props}
		/>
	);
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-content"
			className={cn("px-4 min-w-0 min-h-0 flex-1 overflow-hidden", className)}
			{...props}
		/>
	);
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="card-footer"
			className={cn(
				"flex items-center px-4 pt-2 shrink-0 [.border-t]:pt-4",
				className,
			)}
			{...props}
		/>
	);
}

export {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
	DashboardPinnableCard,
};
