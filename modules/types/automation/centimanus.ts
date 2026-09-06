export type CentimanusWorkflowResult = {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
};

/**
 * The workflow VM. It is a native peer of the message bus, not a microservice,
 * so calls carry its own Fujin target rather than the caller's connection.
 *
 * @nrpcTarget centimanus
 */
export type CentimanusEventResult = {
	/** Execution ids the event started, one per matching trigger. */
	started: string[];
};

export interface CentimanusService {
	runWorkflow(
		scriptPath: string,
		params: Record<string, unknown>,
	): Promise<CentimanusWorkflowResult>;
	/**
	 * One business event from the bus. Called by Fujin with the cluster service
	 * token when a configured trigger's topic matches; never by a browser.
	 */
	onEvent(event: Record<string, unknown>): Promise<CentimanusEventResult>;
}
