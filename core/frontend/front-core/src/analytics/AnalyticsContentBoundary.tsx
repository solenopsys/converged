import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";
import {
	type AnalyticsContentType,
	emitAnalyticsContentEvent,
} from "./content-events";

type AnalyticsContentBoundaryProps = {
	children: ComponentChildren;
	contentId: string;
	contentType: AnalyticsContentType;
};

const MINIMUM_VIEW_MS = 1_000;

export function AnalyticsContentBoundary({
	children,
	contentId,
	contentType,
}: AnalyticsContentBoundaryProps) {
	const rootRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const root = rootRef.current;
		const targets = root ? Array.from(root.children) : [];
		if (
			!root ||
			targets.length === 0 ||
			typeof IntersectionObserver === "undefined"
		)
			return;

		let viewed = false;
		let visibleSince: number | undefined;
		let accumulatedVisibleMs = 0;
		const visibleTargets = new Set<Element>();
		const finishVisibleInterval = () => {
			if (visibleSince === undefined) return;
			accumulatedVisibleMs += Date.now() - visibleSince;
			visibleSince = undefined;
			if (viewed || accumulatedVisibleMs < MINIMUM_VIEW_MS) return;
			viewed = true;
			emitAnalyticsContentEvent({
				event_type: "content_view",
				content_id: contentId,
				content_type: contentType,
				visible_ms: accumulatedVisibleMs,
			});
		};
		const observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					const visible =
						entry.isIntersecting &&
						(entry.intersectionRatio >= 0.25 ||
							entry.intersectionRect.height >= window.innerHeight * 0.25) &&
						document.visibilityState === "visible";
					if (visible) visibleTargets.add(entry.target);
					else visibleTargets.delete(entry.target);
				}
				const visible = visibleTargets.size > 0;
				if (!visible) {
					finishVisibleInterval();
					return;
				}
				if (!viewed && visibleSince === undefined) visibleSince = Date.now();
			},
			{ threshold: [0, 0.25, 1] },
		);
		for (const target of targets) observer.observe(target);

		const onClick = (event: MouseEvent) => {
			if (!event.isTrusted) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			if (!target.closest("a,button,[role='button']")) return;
			emitAnalyticsContentEvent({
				event_type: "content_click",
				content_id: contentId,
				content_type: contentType,
			});
		};
		root.addEventListener("click", onClick, true);
		const onVisibilityChange = () => {
			if (document.visibilityState === "hidden") {
				visibleTargets.clear();
				finishVisibleInterval();
				return;
			}
			for (const target of targets) {
				observer.unobserve(target);
				observer.observe(target);
			}
		};
		document.addEventListener("visibilitychange", onVisibilityChange);
		window.addEventListener(
			"front-core:analytics-before-exit",
			finishVisibleInterval,
		);

		return () => {
			finishVisibleInterval();
			observer.disconnect();
			root.removeEventListener("click", onClick, true);
			document.removeEventListener("visibilitychange", onVisibilityChange);
			window.removeEventListener(
				"front-core:analytics-before-exit",
				finishVisibleInterval,
			);
		};
	}, [contentId, contentType]);

	return (
		<div ref={rootRef} style={{ display: "contents" }}>
			{children}
		</div>
	);
}
