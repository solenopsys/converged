"use client";
import "./HeroRequestBanner.css";

import {
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	PackageCheck,
	PhoneCall,
	Ruler,
	Upload,
} from "lucide-react";
import { useEffect } from "react";
import { CHAT_CONTEXT, VOICE_CONTEXT } from "./context-names";
import { HeroBanner, type HeroBannerData } from "./HeroBanner";
import { type HeroChip, HeroInputDock } from "./HeroInputDock";
import { publishLandingQuickActions } from "./landing-quick-actions";

export interface HeroRequestBannerData extends HeroBannerData {
	request?: {
		placeholder?: string;
		submitLabel?: string;
		attachLabel?: string;
		contextName?: string;
		chips?: HeroRequestChipConfig[];
	};
}

export type HeroRequestChipConfig =
	| string
	| {
			iconName?: string;
			label?: string;
			prompt?: string;
	  };

export interface HeroRequestBannerProps {
	ariaLabel?: string;
	chips?: HeroChip[];
	data?: HeroRequestBannerData;
	id?: string;
	messageInputName?: string;
}

const DEFAULT_HERO_ACTIONS: HeroChip[] = [
	{
		icon: <BadgeCheck size={14} />,
		iconName: "BadgeCheck",
		label: "Check drawing",
		prompt: "I want to check a drawing.",
	},
	{
		icon: <Upload size={14} />,
		iconName: "Upload",
		label: "Upload file",
		prompt: "I want to upload a file for review.",
	},
	{
		icon: <CalendarClock size={14} />,
		iconName: "CalendarClock",
		label: "Estimate deadline",
		prompt: "Help me estimate a deadline.",
	},
	{
		icon: <ClipboardCheck size={14} />,
		iconName: "ClipboardCheck",
		label: "Request quote",
		prompt: "I'd like to request a quote.",
	},
	{
		icon: <PackageCheck size={14} />,
		iconName: "PackageCheck",
		label: "Choose material",
		prompt: "Help me choose a material.",
	},
	{
		icon: <Ruler size={14} />,
		iconName: "Ruler",
		label: "Check tolerances",
		prompt: "Help me check tolerances.",
	},
];

const HERO_ICON_BY_NAME: Record<string, typeof BadgeCheck> = {
	BadgeCheck,
	CalendarClock,
	ClipboardCheck,
	PackageCheck,
	PhoneCall,
	Ruler,
	Upload,
};

export function HeroRequestBanner({
	ariaLabel = "Hero",
	chips,
	data,
	id = "request",
	messageInputName = "hero_request_text",
}: HeroRequestBannerProps) {
	const request = data?.request ?? {};
	const headline = data?.headline || data?.brand || "Precision CNC machining";
	const description =
		data?.description ||
		"Send drawings, STEP/STL/DXF/PDF files or a plain text description. We collect the request details and prepare it for review.";
	const backgroundImage = data?.backgroundImage || data?.image?.src;
	const heroData: HeroBannerData = {
		...data,
		backgroundImage,
		description,
		headline,
	};
	const placeholder =
		request.placeholder ||
		"Describe the part, material, quantity, tolerances, deadline and attach files in chat.";
	const resolvedChips = chips ?? [
		...resolveHeroChips(request.chips),
		{
			icon: <PhoneCall size={16} />,
			iconName: "PhoneCall",
			label: "Call from website",
			prompt: "Call from website",
			eventName: "voice.call",
			contextName: VOICE_CONTEXT,
			variant: "call" as const,
		},
	];

	useEffect(() => {
		publishLandingQuickActions(
			resolvedChips
				.filter((chip) => !chip.eventName)
				.map((chip, index) => ({
					id: toActionId(chip.label, index),
					icon: chip.iconName,
					label: chip.label,
					prompt: chip.prompt,
					contextName: request.contextName || CHAT_CONTEXT,
				})),
		);
	}, [resolvedChips, request.contextName]);

	return (
		<section id={id} className="hsl-root">
			<HeroBanner
				ariaLabel={ariaLabel}
				as="div"
				contentPlacement="raised"
				theme="dark"
				{...heroData}
			/>

			<HeroInputDock
				attachLabel={request.attachLabel}
				chips={resolvedChips}
				contextName={request.contextName || CHAT_CONTEXT}
				messageInputName={messageInputName}
				placeholder={placeholder}
				submitLabel={request.submitLabel}
			/>
		</section>
	);
}

function toActionId(label: string, index: number): string {
	const slug = label
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return slug || `hero-action-${index + 1}`;
}

function resolveHeroChips(chips?: HeroRequestChipConfig[]): HeroChip[] {
	if (!Array.isArray(chips) || chips.length === 0) {
		return DEFAULT_HERO_ACTIONS;
	}

	return chips.flatMap((chip, index) => {
		const fallback = DEFAULT_HERO_ACTIONS[index % DEFAULT_HERO_ACTIONS.length];
		const label = typeof chip === "string" ? chip : chip.label;
		const prompt = typeof chip === "string" ? chip : chip.prompt || chip.label;
		const iconName = typeof chip === "string" ? undefined : chip.iconName;
		const Icon = iconName ? HERO_ICON_BY_NAME[iconName] : undefined;
		if (!label?.trim() || !prompt?.trim()) return [];

		return {
			icon: Icon ? <Icon size={14} /> : fallback.icon,
			iconName: Icon ? iconName : fallback.iconName,
			label: label.trim(),
			prompt,
		};
	});
}
