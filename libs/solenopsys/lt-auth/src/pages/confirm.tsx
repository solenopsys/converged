import { Component } from "@solenopsys/converged-renderer";
import { useLocation } from "@solenopsys/converged-router";
import $ from "@solenopsys/converged-reactive";

const ConfirmComponent: Component = () => {
	const state = $("");
	const location = useLocation();
	const urlParams = new URLSearchParams(location.search);
	const stateParam = urlParams.get("state");

	if (stateParam) {
		state(stateParam);
	}

	return (
		<div>
			{state() === "success" && (
				<>
					<p>Your account is confirmed!</p>
					<a
						style={{
							cursor: "pointer",
							color: "red",
							textDecoration: "underline",
						}}
						href="/login"
					>
						login
					</a>
				</>
			)}
			{state() === "error" && <p>Session expired!</p>}
		</div>
	);
};

export default ConfirmComponent;
