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
export interface CentimanusService {
	runWorkflow(
		scriptPath: string,
		params: Record<string, unknown>,
	): Promise<CentimanusWorkflowResult>;
}
