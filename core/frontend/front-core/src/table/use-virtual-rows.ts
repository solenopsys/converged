import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "preact/hooks";
import type { RefObject } from "preact";

export type VirtualItem = { index: number; start: number; size: number };

type ScrollTarget = HTMLElement | Window;

type ViewportBox = { top: number; bottom: number; height: number };

const OVERSCAN = 5;

const isScrollableNow = (element: HTMLElement) => {
	const { overflowY } = getComputedStyle(element);
	if (overflowY !== "auto" && overflowY !== "scroll") return false;
	return element.scrollHeight > element.clientHeight + 1;
};

// The rows container is not always the scrolling box: surface workspaces
// render the table in normal flow and the shell surface does the scrolling.
// Picking the nearest ancestor that actually scrolls keeps both layouts honest.
const resolveScrollTarget = (element: HTMLElement): ScrollTarget => {
	let node: HTMLElement | null = element;
	while (node) {
		if (isScrollableNow(node)) return node;
		node = node.parentElement;
	}
	return window;
};

const viewportBox = (target: ScrollTarget): ViewportBox => {
	if (target === window) {
		const height = window.innerHeight;
		return { top: 0, bottom: height, height };
	}
	const rect = (target as HTMLElement).getBoundingClientRect();
	return { top: rect.top, bottom: rect.bottom, height: rect.height };
};

const scrollOffset = (container: HTMLElement): number => {
	const view = viewportBox(resolveScrollTarget(container));
	return Math.max(0, view.top - container.getBoundingClientRect().top);
};

type UseVirtualRowsParams = {
	count: number;
	rowSize: number;
	containerRef: RefObject<HTMLElement | null>;
	restoreKey: string;
	initialScrollOffset: number;
	onScrollOffsetChange?: (offset: number) => void;
};

export type VirtualRows = {
	virtualItems: VirtualItem[];
	totalSize: number;
	getScrollOffset: () => number;
	/** px of rendered content still below the viewport bottom, null if unmeasurable */
	remainingBelowViewport: () => number | null;
	remeasure: () => void;
};

export const useVirtualRows = ({
	count,
	rowSize,
	containerRef,
	restoreKey,
	initialScrollOffset,
	onScrollOffsetChange,
}: UseVirtualRowsParams): VirtualRows => {
	const [range, setRange] = useState({ start: 0, end: 0 });
	const initialOffsetRef = useRef(initialScrollOffset);
	const onOffsetChangeRef = useRef(onScrollOffsetChange);
	const restoredKeyRef = useRef<string | null>(null);
	const lastReportedOffsetRef = useRef(initialScrollOffset);
	const latestOffsetRef = useRef(initialScrollOffset);
	const reportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	initialOffsetRef.current = initialScrollOffset;
	onOffsetChangeRef.current = onScrollOffsetChange;

	const restoreScroll = useCallback(() => {
		if (restoredKeyRef.current === restoreKey) return;
		const container = containerRef.current;
		if (!container || container.getBoundingClientRect().height <= 0) return;

		const target = resolveScrollTarget(container);
		const currentOffset = scrollOffset(container);
		const delta = initialOffsetRef.current - currentOffset;
		if (Math.abs(delta) > 1) {
			if (target === window) window.scrollBy(0, delta);
			else (target as HTMLElement).scrollTop += delta;
		}
		restoredKeyRef.current = restoreKey;
		lastReportedOffsetRef.current = initialOffsetRef.current;
		latestOffsetRef.current = initialOffsetRef.current;
	}, [containerRef, restoreKey]);

	const reportScroll = useCallback((offset: number) => {
		latestOffsetRef.current = offset;
		if (reportTimerRef.current !== null) {
			clearTimeout(reportTimerRef.current);
			reportTimerRef.current = null;
		}
		if (Math.abs(offset - lastReportedOffsetRef.current) < 4) return;
		reportTimerRef.current = setTimeout(() => {
			reportTimerRef.current = null;
			lastReportedOffsetRef.current = latestOffsetRef.current;
			onOffsetChangeRef.current?.(latestOffsetRef.current);
		}, 100);
	}, []);

	const measure = useCallback(() => {
		const container = containerRef.current;
		if (!container) return;

		const view = viewportBox(resolveScrollTarget(container));
		if (view.height <= 0) return;

		const rect = container.getBoundingClientRect();
		const above = view.top - rect.top;
		const start = Math.max(0, Math.floor(above / rowSize) - OVERSCAN);
		const end = Math.min(
			count,
			Math.ceil((above + view.height) / rowSize) + OVERSCAN,
		);

		setRange((previous) =>
			previous.start === start && previous.end === end
				? previous
				: { start, end },
		);
	}, [containerRef, count, rowSize]);

	const remainingBelowViewport = useCallback(() => {
		const container = containerRef.current;
		if (!container) return null;

		const view = viewportBox(resolveScrollTarget(container));
		if (view.height <= 0) return null;

		const rect = container.getBoundingClientRect();
		if (rect.height <= 0) return null;

		return rect.bottom - view.bottom;
	}, [containerRef]);

	const getScrollOffset = useCallback(() => {
		const container = containerRef.current;
		return container ? scrollOffset(container) : 0;
	}, [containerRef]);

	useLayoutEffect(() => {
		restoreScroll();
		measure();
	}, [measure, restoreScroll]);

	useEffect(() => {
		restoreScroll();
		measure();

		let frame = 0;
		const schedule = () => {
			if (frame) return;
			frame = requestAnimationFrame(() => {
				frame = 0;
				restoreScroll();
				measure();
				const container = containerRef.current;
				if (container) reportScroll(scrollOffset(container));
			});
		};

		// capture phase catches scroll from whichever ancestor owns the scrollbar
		window.addEventListener("scroll", schedule, { passive: true, capture: true });
		window.addEventListener("resize", schedule, { passive: true });

		const resizeObserver = new ResizeObserver(schedule);
		if (containerRef.current) resizeObserver.observe(containerRef.current);

		return () => {
			if (frame) cancelAnimationFrame(frame);
			window.removeEventListener("scroll", schedule, { capture: true });
			window.removeEventListener("resize", schedule);
			resizeObserver.disconnect();
		};
	}, [measure, containerRef, reportScroll, restoreScroll]);

	useEffect(
		() => () => {
			if (reportTimerRef.current !== null)
				clearTimeout(reportTimerRef.current);
			reportTimerRef.current = null;
			const container = containerRef.current;
			if (container && restoredKeyRef.current === restoreKey)
				onScrollOffsetChange?.(scrollOffset(container));
		},
		[containerRef, restoreKey, onScrollOffsetChange],
	);

	const virtualItems = useMemo(() => {
		const end = Math.min(range.end, count);
		const length = Math.max(0, end - range.start);
		return Array.from({ length }, (_, offset) => {
			const index = range.start + offset;
			return { index, size: rowSize, start: index * rowSize };
		});
	}, [range.start, range.end, count, rowSize]);

	return {
		virtualItems,
		totalSize: count * rowSize,
		getScrollOffset,
		remainingBelowViewport,
		remeasure: measure,
	};
};
