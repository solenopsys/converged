import type { ComponentType } from "preact";
import { workspaceTabOpened } from "./workspace";

export type OpenRecordTabRequest<TProps extends Record<string, unknown>> = {
	/** Микрофронтенд-владелец: по нему группируются вкладки и их действия. */
	owner: string;
	/** Идентификатор записи: он же отличает вкладки одной таблицы друг от друга. */
	recordId: string;
	title: string;
	view: ComponentType<TProps>;
	props?: TProps;
	pinned?: boolean;
};

/**
 * Клик по строке таблицы открывает запись во вкладке рабочей области.
 *
 * Раньше форма монтировалась в панель чата, поэтому запись всегда была одна:
 * следующий клик затирал предыдущую. Ключ вкладки собирается из владельца и id
 * записи, так что открытых карточек может быть сколько угодно, любую можно
 * закрепить, а незакреплённые уедут при следующей команде ассистенту.
 */
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
