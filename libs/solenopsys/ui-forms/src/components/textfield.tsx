import $ from "@solenopsys/converged-reactive";
import { Component } from "@solenopsys/converged-renderer";

export const UiTextField: Component<any> = (props: any) => {
	const value = $(props.value || "");
	const password = $(props.password || false);

	const handleChange = (event: any) => {
		value(event.target.value);
		if (props.valueChange) {
			props.valueChange(event.target.value);
		}
	};

	return (
		<input
			type={password() ? "password" : "text"}
			style={{ width: props.width + "px" }}
			value={value()}
			onInput={handleChange}
		/>
	);
};