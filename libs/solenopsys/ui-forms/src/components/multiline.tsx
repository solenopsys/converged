import $ from "@solenopsys/converged-reactive";
import { Component } from "@solenopsys/converged-renderer";

export const UiMultilineField: Component = (props: any) => {
	const value = $(props.value || "");

	const handleChange = (event: any) => {
		value(event.target.value);
		if (props.valueChange) {
			props.valueChange(event.target.value);
		}
	};

	return (
		<textarea
			style={{ width: props.width + "px" }}
			value={value()}
			onInput={handleChange}
			rows={5}
		/>
	);
};

