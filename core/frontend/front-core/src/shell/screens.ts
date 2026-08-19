import { actionCommandActivated, type ScreenDecl } from "front-core/core";
import { workspaceTabClosed, workspaceTabOpened } from "./workspace";



const watched = new Set<string>();

export function registerScreens(screens: ScreenDecl<any>[]): void {
	for (const screen of screens) {
		if (watched.has(screen.id)) continue;
		watched.add(screen.id);
		screen.when.watch((value) => apply(screen, value));
		actionCommandActivated.watch(({ actionId }) => {
			if (ownerFor(actionId) !== ownerFor(screen.id)) return;
			apply(screen, screen.when.getState());
		});
	}
}

function ownerFor(id: string): string {
	return id.split(".", 1)[0] ?? id;
}

function apply(screen: ScreenDecl<any>, value: unknown): void {
	if (!matches(screen, value)) {
		workspaceTabClosed(screen.id);
		return;
	}

	workspaceTabOpened({
		key: screen.id,
		owner: ownerFor(screen.id),
		view: screen.view,
		props: screen.props?.(value) ?? {},
		title:
			(typeof screen.title === "function" ? screen.title(value) : screen.title) ??
			screen.id,
	});
}

function matches(screen: ScreenDecl<any>, value: unknown): boolean {
	return typeof screen.is === "function"
		? Boolean((screen.is as (value: unknown) => boolean)(value))
		: screen.is === value;
}
