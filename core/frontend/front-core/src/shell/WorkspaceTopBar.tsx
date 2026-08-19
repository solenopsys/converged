import { useUnit } from "effector-preact";
import type { ComponentChildren } from "preact";
import { TopBar, type TopBarLink } from "./TopBar";
import { TopBarSettings } from "./TopBarControls";
import { $workspaceTabViews, workspaceTabActionInvoked } from "./tab-actions";
import { workspaceReset, workspaceTabActivated, workspaceTabClosed } from "./workspace";

/**
 * Умная обёртка над панелью: подписывается на модель вкладок и переводит
 * нажатия в события. Панель остаётся чистой функцией от данных, поэтому
 * следующий вид содержимого (форма, карточка записи, отчёт) добавляется
 * открытием вкладки, а не правкой шапки.
 */
export function WorkspaceTopBar({
	brand,
	brandHref,
	links,
	controls,
}: {
	brand: ComponentChildren;
	brandHref?: string;
	links?: TopBarLink[];
	controls?: ComponentChildren;
}) {
	const tabs = useUnit($workspaceTabViews);

	return (
		<TopBar
			brand={brand}
			brandHref={brandHref}
			// Бренд возвращает на лендинг: закрыть рабочую область целиком.
			onBrandClick={tabs.length > 0 ? () => workspaceReset() : undefined}
			tabs={tabs}
			links={links}
			onTabSelect={workspaceTabActivated}
			onTabClose={workspaceTabClosed}
			onTabAction={(key, actionId) => workspaceTabActionInvoked({ key, actionId })}
			controls={
				<>
					{controls}
					<TopBarSettings />
				</>
			}
		/>
	);
}
