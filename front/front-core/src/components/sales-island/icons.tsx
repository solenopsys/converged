/**
 * Sales Island — icon registry.
 *
 * Config references icons by name; the SVG geometry lives here in code so the
 * JSON stays small and localizable. All glyphs share a 24×24 viewBox and inherit
 * `currentColor`, so callers control size/color via CSS.
 */

import type { ReactNode } from "react";
import type { SalesIslandIconName } from "./types";

const GLYPHS: Record<SalesIslandIconName, ReactNode> = {
	robot: (
		<>
			<path d="M12 8V4H8" />
			<rect x="4" y="8" width="16" height="12" rx="2" />
			<path d="M2 14h2M20 14h2M15 13v2M9 13v2" />
		</>
	),
	spark: <path d="M13 2 3 14h9l-1 8 10-12h-9z" />,
	chat: (
		<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
	),
	rfq: (
		<>
			<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
			<path d="M14 2v6h6" />
		</>
	),
	upload: (
		<>
			<path d="M12 3v12" />
			<path d="m7 8 5-5 5 5" />
			<path d="M5 21h14" />
		</>
	),
	leads: (
		<>
			<rect x="3" y="4" width="18" height="16" rx="2" />
			<path d="M3 10h18" />
		</>
	),
	hosting: <path d="M5 12h14M12 5v14" />,
	setup: (
		<>
			<circle cx="12" cy="12" r="3" />
			<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
		</>
	),
	updates: (
		<>
			<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
			<path d="M21 3v5h-5" />
			<path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
			<path d="M8 16H3v5" />
		</>
	),
	phone: (
		<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
	),
	shield: (
		<>
			<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
			<path d="m9 12 2 2 4-4" />
		</>
	),
	key: (
		<>
			<circle cx="8" cy="15" r="4" />
			<path d="m10.85 12.15 6.15-6.15" />
			<path d="m18 5 2 2" />
			<path d="m15 8 2 2" />
		</>
	),
	arrow: (
		<>
			<path d="M5 12h14" />
			<path d="m12 5 7 7-7 7" />
		</>
	),
	chevron: <path d="m18 15-6-6-6 6" />,
	close: <path d="M18 6 6 18M6 6l12 12" />,
};

export function SalesIslandIcon({
	name,
	className,
	strokeWidth = 2.2,
}: {
	name?: SalesIslandIconName;
	className?: string;
	strokeWidth?: number;
}) {
	if (!name) return null;
	const glyph = GLYPHS[name];
	if (!glyph) return null;

	return (
		<svg
			aria-hidden="true"
			className={className}
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={strokeWidth}
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			{glyph}
		</svg>
	);
}
