import type { ComponentType } from "preact";
import { workspaceTabOpened } from "./workspace";

export type OpenRecordTabRequest<TProps extends Record<string, unknown>> = {

	owner: string;

	recordId: string;
	title: string;
	view: ComponentType<TProps>;
	props?: TProps;
	pinned?: boolean;
};


export function openRecordTab<TProps extends Record<string, unknown>>({
	owner,
	recordId,
	title,
	view,
	props,
	pinned,
}: OpenRecordTabRequest<TProps>): void {
	workspaceTabOpened({
		key: `${owner}:${recordId}`,
		owner,
		title,
		view: view as ComponentType<Record<string, unknown>>,
		props: props ?? ({} as TProps),
		...(pinned === undefined ? {} : { pinned }),
	});
}
