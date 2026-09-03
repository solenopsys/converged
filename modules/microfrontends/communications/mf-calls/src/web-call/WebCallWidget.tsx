import { useUnit } from "effector-preact";
import { PhoneOff } from "front-core";
import { $webCall, hangupWebCall, type WebCallStatus } from "./controller";
import "./WebCallWidget.css";

const STATUS_LABEL: Record<WebCallStatus, string> = {
	idle: "",
	connecting: "Connecting…",
	connected: "On call",
	error: "Call failed",
	ended: "Call ended",
};

export function WebCallWidget() {
	const state = useUnit($webCall);
	if (state.status === "idle") return null;

	const active = state.status === "connecting" || state.status === "connected";

	return (
		<div
			className="wcw"
			data-status={state.status}
			data-warn={!state.error && state.warning ? "1" : undefined}
			role="status"
			aria-live="polite"
		>
			<span className="wcw-dot" aria-hidden="true" />
			<span className="wcw-label">
				{state.error ?? state.warning ?? STATUS_LABEL[state.status]}
			</span>
			{active && (
				<button
					className="wcw-hangup"
					type="button"
					aria-label="Hang up"
					title="Hang up"
					onClick={() => hangupWebCall()}
				>
					<PhoneOff size={14} />
				</button>
			)}
		</div>
	);
}
