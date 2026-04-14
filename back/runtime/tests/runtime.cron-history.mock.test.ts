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

const dagListResumableExecutionsMock = mock(async () => ({ items: [] }));
const dagListVarsMock = mock(async () => ({ items: [] }));
const dagSetVarMock = mock(async (_key: string, _value: any) => {});
const dagOpenExecutionMock = mock(async (_id: string, _workflowName: string, _params: Record<string, any>) => {});
const dagSetExecutionStatusMock = mock(async (_id: string, _status: string) => {});
const dagGetCachedNodeResultMock = mock(async (_executionId: string, _nodeId: string) => ({ hit: false }));
const dagCreateTaskMock = mock(async () => ({ id: 1, createdAt: 10 }));
const dagSetTaskProcessingMock = mock(async (_taskId: number, _startedAt: number) => {});
const dagSetTaskDoneMock = mock(async (_taskId: number, _executionId: string, _nodeId: string, _completedAt: number, _result: any) => {});
const dagSetTaskFailedMock = mock(async (_taskId: number, _completedAt: number, _errorMessage: string) => {});
const createDagServiceClientMock = mock(() => ({
  listResumableExecutions: dagListResumableExecutionsMock,
  listVars: dagListVarsMock,
  setVar: dagSetVarMock,
  openExecution: dagOpenExecutionMock,
  setExecutionStatus: dagSetExecutionStatusMock,
  getCachedNodeResult: dagGetCachedNodeResultMock,
  createTask: dagCreateTaskMock,
  setTaskProcessing: dagSetTaskProcessingMock,
  setTaskDone: dagSetTaskDoneMock,
  setTaskFailed: dagSetTaskFailedMock,
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
    dagListResumableExecutionsMock.mockClear();
    dagListVarsMock.mockClear();
    dagSetVarMock.mockClear();
    dagOpenExecutionMock.mockClear();
    dagSetExecutionStatusMock.mockClear();
    dagGetCachedNodeResultMock.mockClear();
    dagCreateTaskMock.mockClear();
    dagSetTaskProcessingMock.mockClear();
    dagSetTaskDoneMock.mockClear();
    dagSetTaskFailedMock.mockClear();
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

  test("should execute workflow in runtime and persist node state through dag storage API", async () => {
    class MockWorkflow {
      readonly id: string;

      constructor(private readonly ctx: any, id?: string) {
        this.id = id ?? "wf-id";
      }

      async start(params: any): Promise<void> {
        await this.ctx.runNode(this.id, "node.mock", async () => ({ value: params.value }));
      }
    }

    const { service, shutdown } = await createRuntimeService({
      workflows: {
        WORKFLOWS: [{ name: "wf.mock", ctor: MockWorkflow }],
      },
    });

    const events: any[] = [];
    for await (const event of service.startExecution("wf.mock", { value: 9 })) {
      events.push(event);
    }

    expect(events.some((event) => event.type === "started")).toBe(true);
    expect(events.some((event) => event.type === "completed")).toBe(true);
    expect(dagOpenExecutionMock).toHaveBeenCalledTimes(1);
    expect(dagCreateTaskMock).toHaveBeenCalledTimes(1);
    expect(dagSetTaskProcessingMock).toHaveBeenCalledTimes(1);
    expect(dagSetTaskDoneMock).toHaveBeenCalledTimes(1);
    expect(dagSetTaskFailedMock).toHaveBeenCalledTimes(0);

    await shutdown();
  });

  test("should persist null task result when node handler returns void", async () => {
    class VoidWorkflow {
      readonly id: string;

      constructor(private readonly ctx: any, id?: string) {
        this.id = id ?? "wf-void";
      }

      async start(): Promise<void> {
        await this.ctx.runNode(this.id, "node.void", async () => {
          return;
        });
      }
    }

    const { service, shutdown } = await createRuntimeService({
      workflows: {
        WORKFLOWS: [{ name: "wf.void", ctor: VoidWorkflow }],
      },
    });

    for await (const _event of service.startExecution("wf.void", {})) {
      // consume all events until completion
    }

    expect(dagSetTaskDoneMock).toHaveBeenCalledTimes(1);
    expect(dagSetTaskDoneMock.mock.calls[0][4]).toBeNull();

    await shutdown();
  });
});
