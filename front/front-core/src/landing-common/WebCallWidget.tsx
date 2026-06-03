import { useUnit } from "effector-react";
import { PhoneOff } from "lucide-react";
import { $webCall, hangupWebCall, type WebCallStatus } from "./web-call";

const STATUS_LABEL: Record<WebCallStatus, string> = {
	idle: "",
	connecting: "Connecting…",
	connected: "On call",
	error: "Call failed",
	ended: "Call ended",
};

/**
 * Floating status pill for the landing "call from website" flow. Renders nothing
 * while idle; shows connecting/connected state with a hang-up button otherwise.
 */
export function WebCallWidget() {
	const state = useUnit($webCall);
	if (state.status === "idle") return null;

	const active = state.status === "connecting" || state.status === "connected";

	return (
		<div className="wcw" data-status={state.status} role="status" aria-live="polite">
			<style>{webCallWidgetCss}</style>
			<span className="wcw-dot" aria-hidden="true" />
			<span className="wcw-label">{state.error ?? STATUS_LABEL[state.status]}</span>
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

const webCallWidgetCss = `
.wcw {
	position: fixed;
	right: 18px;
	bottom: 18px;
	z-index: 1000;
	display: inline-flex;
	align-items: center;
	gap: 10px;
	padding: 10px 14px;
	border: 1px solid color-mix(in oklch, var(--ui-border) 70%, transparent);
	border-radius: 999px;
	background: color-mix(in oklch, var(--ui-card) 94%, transparent);
	backdrop-filter: blur(16px);
	-webkit-backdrop-filter: blur(16px);
	box-shadow: 0 8px 28px color-mix(in oklch, oklch(0% 0 0) 24%, transparent);
	color: var(--ui-foreground);
	font-size: 13px;
	font-weight: 700;
}

.wcw-dot {
	width: 8px;
	height: 8px;
	border-radius: 50%;
	background: var(--ui-chart-2);
	flex-shrink: 0;
}

.wcw[data-status="connecting"] .wcw-dot { background: #f59e0b; animation: wcw-pulse 1s ease-in-out infinite; }
.wcw[data-status="connected"]  .wcw-dot { background: #22c55e; }
.wcw[data-status="error"]      .wcw-dot { background: #ef4444; }
.wcw[data-status="ended"]      .wcw-dot { background: var(--ui-muted-foreground); }

.wcw-label { white-space: nowrap; }

.wcw-hangup {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	width: 28px;
	height: 28px;
	border: 0;
	border-radius: 999px;
	background: #ef4444;
	color: #fff;
	cursor: pointer;
	flex-shrink: 0;
}

.wcw-hangup:hover { background: #dc2626; }

@keyframes wcw-pulse {
	0%, 100% { opacity: 1; }
	50% { opacity: 0.4; }
}
`;
