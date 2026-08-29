export type CentimanusWorkflowResult = {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
};

export interface CentimanusService {
	runWorkflow(
		scriptPath: string,
		params: Record<string, unknown>,
	): Promise<CentimanusWorkflowResult>;
}
