import type { ReactNode } from "react";
import { useUnit } from "effector-react";
import { $controlPanelMode } from "../../landing-common/control-panel-model";
import { LandingTopBarIntegration } from "../landing-topbar/LandingTopBarIntegration";
import { ConvergedRailPanelIntegration } from "../converged-rail-panel/ConvergedRailPanelIntegration";

export interface ControlPanelProps {
	chatSlot?: ReactNode;
	menuSlot?: ReactNode;
	composerPlaceholder?: string;
	tabContents?: Record<string, ReactNode>;
}

export function ControlPanel({ chatSlot, menuSlot, composerPlaceholder, tabContents }: ControlPanelProps = {}) {
	const mode = useUnit($controlPanelMode);

	if (mode === "public") {
		return <LandingTopBarIntegration compact />;
	}
	return (
		<ConvergedRailPanelIntegration
			chatSlot={chatSlot}
			menuSlot={menuSlot}
			composerPlaceholder={composerPlaceholder}
			tabContents={tabContents}
		/>
	);
}
