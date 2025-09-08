import { test, expect, mock } from "bun:test";
import { InitLambdaAspect } from "../implements/init-lambda";

test("InitLambdaAspect creates lambda when executions empty", () => {
    const mockContext = {
        getFromPath: mock(),
        setToPath: mock()
    };
    
    const mockWorker = {
        state: { 
            executions: [],
            workerId: "test-id",
            input: { data: "test" }
        }
    };
    
    const aspect = new InitLambdaAspect();
    aspect.execute(mockWorker as any, mockContext as any);
    
    expect(mockWorker.state.executions).toHaveLength(1);
});