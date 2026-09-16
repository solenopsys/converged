import { getIconByName, Play } from "../icons";
import type { TabKind } from "./model";

/** An item's icon by name; a command without one still reads as runnable. */
export function TabIcon({ name, kind }: { name?: string; kind: TabKind }) {
	const Icon =
		(name ? getIconByName(name) : null) ?? (kind === "command" ? Play : null);
	return Icon ? <Icon size={13} class="tab-icon" aria-hidden="true" /> : null;
}
