/**
 * Sales Island — auto-expand on scroll end.
 *
 * The dock unfolds itself once the reader hits the bottom of the landing. The
 * state still lives in effector: this only watches the DOM boundary and pushes a
 * signal in — `onReachBottom` calls the same `opened` event a click does. It is
 * the scroll-side counterpart to a button's `onClick`, nothing more.
 *
 * Detection is an `IntersectionObserver` (the same primitive the island loader
 * uses), not a scroll listener: a 1px sentinel is appended at the end of the
 * scrollable content, and entering the viewport fires the signal. The observer
 * only reacts to visibility *changes*, so it self-latches for free — opening
 * once at the bottom and re-firing only after the reader scrolls away and back,
 * which leaves a manual close at the bottom respected.
 */

type AutoExpandOptions = {
	/**
	 * Skip the desktop breakpoint guard. By default auto-expand only runs on the
	 * desktop dock (the mobile sheet is full-screen and too intrusive to pop open
	 * automatically).
	 */
	mobile?: boolean;
};

const DESKTOP_MIN_WIDTH = "(min-width: 901px)";

/** The island is `position: fixed`, so walk up to what actually scrolls. */
function findScrollContainer(start: HTMLElement): HTMLElement | null {
	let el: HTMLElement | null = start.parentElement;
	while (el && el !== document.body && el !== document.documentElement) {
		const overflowY = getComputedStyle(el).overflowY;
		if (
			(overflowY === "auto" || overflowY === "scroll") &&
			el.scrollHeight > el.clientHeight
		) {
			return el;
		}
		el = el.parentElement;
	}
	return null;
}

/**
 * Fire `onReachBottom` when the landing is scrolled to its end. Returns a
 * cleanup function that disconnects the observer and removes the sentinel.
 */
export function bindAutoExpandOnScrollEnd(
	element: HTMLElement,
	onReachBottom: () => void,
	options: AutoExpandOptions = {},
): () => void {
	if (typeof window === "undefined" || typeof IntersectionObserver === "undefined")
		return () => {};

	const scrollContainer = findScrollContainer(element);
	const host = scrollContainer ?? document.body;

	const sentinel = document.createElement("div");
	sentinel.setAttribute("data-sales-island-sentinel", "");
	sentinel.style.cssText = "height:1px;width:100%;pointer-events:none;";
	host.appendChild(sentinel);

	const isDesktop = () =>
		Boolean(options.mobile) || window.matchMedia(DESKTOP_MIN_WIDTH).matches;

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting && isDesktop()) onReachBottom();
			}
		},
		{ root: scrollContainer ?? null },
	);
	observer.observe(sentinel);

	return () => {
		observer.disconnect();
		sentinel.remove();
	};
}
