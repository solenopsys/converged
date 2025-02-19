import { Component } from "@solenopsys/converged-renderer";
import $ from "@solenopsys/converged-reactive";

const StatusComponent: Component = () => {
	const sessions = $([]);

	function keyPrefix(key) {
		return key.substr(0, 5);
	}

	function deleteSession(pubKey) {
		SESSION_SERVICE.deleteSession(pubKey);
		loadSessions();
	}

	async function loadSessions() {
		const sessionsData = await SESSION_SERVICE.getSessions();
		console.log("LOADED SESSIONS", sessionsData);
		sessions(sessionsData);
	}

	loadSessions();

	return (
		<>
			<h4>Sessions</h4>
			{sessions() && (
				<div>
					{sessions().map((s) => (
						<div>
							{keyPrefix(s.pubKey)}... -{" "}
							{new Date(s.expiredAt).toLocaleString("en-US", {
								year: "numeric",
								month: "2-digit",
								day: "2-digit",
								hour: "2-digit",
								minute: "2-digit",
							})}
							<button onClick={() => deleteSession(s.pubKey)}>Delete</button>
						</div>
					))}
				</div>
			)}
		</>
	);
};

export default StatusComponent;
