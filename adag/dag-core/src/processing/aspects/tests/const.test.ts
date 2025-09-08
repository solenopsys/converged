import { test, expect, mock } from "bun:test";
import { ConstAspect } from "../implements/const";

test("ConstAspect adds constants", () => {
    const mockContext = {
        getFromPath: mock(),
        setToPath: mock()
    };
    
    const mockWorker = {
        state: { input: {} }
    };
    
    const aspect = new ConstAspect({ version: "1.0" });
    aspect.execute(mockWorker as any, mockContext as any);
    
    expect(mockWorker.state.input.version).toBe("1.0");
});