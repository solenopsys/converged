
import { test, expect, mock } from "bun:test";
import { InjectAspect } from "../implements/inject";

test("InjectAspect executes correctly", () => {
    const mockContext = {
        getFromPath: mock(() => "injected-value"),
        setToPath: mock()
    };
    
    const mockWorker = {
        state: { input: { existing: "data" } }
    };
    
    const aspect = new InjectAspect({ key: "$.path" });
    aspect.execute(mockWorker as any, mockContext as any);
    
    expect(mockContext.getFromPath).toHaveBeenCalledWith("$.path");
    expect(mockWorker.state.input.key).toBe("injected-value");
});
