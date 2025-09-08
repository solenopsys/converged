import { test, expect, mock } from "bun:test";
import { CopyResultAspect } from "../implements/result";

test("CopyResultAspect copies result to context", () => {
    const mockContext = {
        getFromPath: mock(),
        setToPath: mock()
    };
    
    const mockWorker = {
        name: "test-worker",
        state: {
            executions: [{ _lastResult: "result-data" }]
        }
    };
    
    const aspect = new CopyResultAspect("$.workers.test-worker.result");
    aspect.execute(mockWorker as any, mockContext as any);
    
    expect(mockContext.setToPath).toHaveBeenCalledWith(
        "$.workers.test-worker.result", 
        "result-data"
    );
});