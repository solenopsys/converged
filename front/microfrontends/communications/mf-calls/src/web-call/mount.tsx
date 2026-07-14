import { createRoot, type Root } from "react-dom/client";
import { WebCallWidget } from "./WebCallWidget";

let root: Root | null = null;

export function mountWebCallWidget(): void {
	if (root || typeof document === "undefined") return;
	const container = document.createElement("div");
	container.dataset.mfCallsWebCall = "";
	document.body.append(container);
	root = createRoot(container);
	root.render(<WebCallWidget />);
}
