import { normalizeProps, useMachine } from "@zag-js/preact";
import * as tooltip from "@zag-js/tooltip";
import type { ComponentChildren, JSX } from "preact";
import { useId } from "preact/hooks";


export function WithTooltip({
	label,
	children,
}: {
	label: string;
	children: (props: JSX.HTMLAttributes<HTMLButtonElement>) => ComponentChildren;
}) {
	const service = useMachine(tooltip.machine, {
		id: useId(),
		openDelay: 450,
		closeDelay: 80,
	});
	const api = tooltip.connect(service, normalizeProps);

	return (
		<>
			{children(api.getTriggerProps() as JSX.HTMLAttributes<HTMLButtonElement>)}
			{api.open ? (
				<div {...api.getPositionerProps()}>
					<div {...api.getContentProps()} class="send-tooltip">
						{label}
					</div>
				</div>
			) : null}
		</>
	);
}
