export interface RuntimeWorkflowResult {
	executionId: string;
	ok: boolean;
	result?: unknown;
	error?: string;
}


export interface RuntimeDagService {
	runWorkflow(
		scriptPath: string,
		params: Record<string, unknown>,
	): Promise<RuntimeWorkflowResult>;
}
