import type { StreamlineIconProps } from "../icons";

export function PushPin(
	props: StreamlineIconProps & { pinned?: boolean },
) {
	const { size = 14, pinned = false, ...attributes } = props;
	return (
		<svg
			{...attributes}
			width={size}
			height={size}
			viewBox="0 0 16 16"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.4"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			focusable="false"
		>
			<path
				d="M5 1.5h6l-.8 4.2 2 2.3H8v5.5L7 14V8H3.8l2-2.3L5 1.5Z"
				fill={pinned ? "currentColor" : "none"}
			/>
		</svg>
	);
}

export function PinnedPushPin(props: StreamlineIconProps) {
	return <PushPin {...props} pinned />;
}
