import type { ComponentType } from "preact";
import { subtabOpened } from "./workspace";

export type OpenRecordTabRequest<TProps extends Record<string, unknown>> = {
	/** The surface this record belongs to — the tab its button appears under. */
	surface: string;
	recordId: string;
	title: string;
	view: ComponentType<TProps>;
	props?: TProps;
};

/** Opens one record as a button inside its own surface, not as a new tab. */
export function openRecordTab<TProps extends Record<string, unknown>>({
	surface,
	recordId,
	title,
	view,
	props,
}: OpenRecordTabRequest<TProps>): void {
	subtabOpened({
		key: `${surface}:${recordId}`,
		surface,
		title,
		view: view as ComponentType<Record<string, unknown>>,
		props: props ?? ({} as TProps),
	});
}
