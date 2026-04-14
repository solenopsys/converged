import { beforeEach, describe, expect, mock, test } from "bun:test";

const recordHistoryMock = mock(async (entry: any) => ({
  id: "hist-1",
  firedAt: new Date().toISOString(),
  ...entry,
}));

const listCronsMock = mock(async (_params: any) => ({ items: [] }));
const createShedullerServiceClientMock = mock(() => ({
  listCrons: listCronsMock,
  recordHistory: recordHistoryMock,
}));

const dagStartExecutionMock = mock(
  (_workflowName: string, _params: Record<string, any>): AsyncIterable<any> =>
    (async function* () {})(),
);
const dagCreateExecutionMock = mock(async () => ({ id: "exec-1" }));
const dagResumeActiveExecutionsMock = mock(async () => ({
  resumed: 0,
  skipped: 0,
  failed: 0,
  ids: [],
}));
const createDagServiceClientMock = mock(() => ({
  startExecution: dagStartExecutionMock,
  createExecution: dagCreateExecutionMock,
  resumeActiveExecutions: dagResumeActiveExecutionsMock,
}));

mock.module("g-sheduller", () => ({
  createShedullerServiceClient: createShedullerServiceClientMock,
}));

mock.module("g-dag", () => ({
  createDagServiceClient: createDagServiceClientMock,
}));

mock.module("./gates/send-magic-link", () => ({
  sendMagicLink: mock(async (_params: any) => {}),
}));

async function createRuntimeService(config: Record<string, any> = {}) {
  const { default: RuntimeServiceImpl } = await import("../service");
  const shutdownTasks: Array<() => Promise<void>> = [];
  const service = new RuntimeServiceImpl({
    ...config,
    registerShutdownTask: (_name: string, task: () => Promise<void>) => {
      shutdownTasks.push(task);
    },
  });

  const shutdown = async () => {
    for (const task of shutdownTasks) {
      await task();
    }
  };

  return { service, shutdown };
}

describe("Runtime cron history bridge with mocked cron engine", () => {
  beforeEach(() => {
    recordHistoryMock.mockClear();
    listCronsMock.mockClear();
    createShedullerServiceClientMock.mockClear();
    dagStartExecutionMock.mockClear();
    dagCreateExecutionMock.mockClear();
    dagResumeActiveExecutionsMock.mockClear();
    createDagServiceClientMock.mockClear();
  });

  test("should persist cron run result through sheduller service client", async () => {
    const { service, shutdown } = await createRuntimeService();
    await (service as any).recordCronHistory({
      cronId: "cron-77",
      cronName: "check-sync",
      provider: "dag",
      action: "runWorkflow",
      success: false,
      message: "workflow failed",
    });

    expect(recordHistoryMock).toHaveBeenCalledTimes(1);
    expect(recordHistoryMock).toHaveBeenCalledWith({
      cronId: "cron-77",
      cronName: "check-sync",
      provider: "dag",
      action: "runWorkflow",
      success: false,
      message: "workflow failed",
    });

    await shutdown();
  });

  test("should expose workflow names from runtime config", async () => {
    const { service, shutdown } = await createRuntimeService({
      workflows: {
        WORKFLOWS: [
          { name: "wf.alpha" },
          { name: "wf.beta" },
        ],
      },
    });

    const result = await service.listWorkflows();
    expect(result).toEqual({ names: ["wf.alpha", "wf.beta"] });

    await shutdown();
  });
});
