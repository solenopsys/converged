// worker.integration.test.ts
import { test, expect } from "bun:test";
import { 
    WorkerImpl, 
} from "./worker";
import { JsonPathExecutionContext } from "./utils";
import { InjectAspect } from "./implements/inject";
import { ConstAspect } from "./implements/const";
import { InitLambdaAspect } from "./implements/init-lambda";
import { CopyResultAspect } from "./implements/result";

 

test("Worker full integration test", async () => {
    // Arrange
    const context = new JsonPathExecutionContext({
        params: {
            multiplier: 3,
            prefix: "processed_"
        },
        workers: {}
    });

    const processData = async (input: any) => {
        return {
            result: `${input.prefix}${input.data}_x${input.multiplier}`,
            timestamp: input.timestamp
        };
    };

    const worker = new WorkerImpl("integration-test")
        .addAspect(new InjectAspect({ 
            multiplier: "$.params.multiplier",
            prefix: "$.params.prefix"
        }))
        .addAspect(new ConstAspect({ 
            timestamp: 123456789,
            version: "1.0"
        }))
        .addAspect(new InitLambdaAspect())
        .addAspect(new CopyResultAspect("$.workers.integration-test.result"));

    worker.state.input = { data: "test_value" };

    // Act
    const result = await worker.init(context, processData);

    // Assert
    expect(result).toBe("success");
    
    // Debug что реально в контексте
    console.log("Context data:", JSON.stringify((context as any).data, null, 2));
    
    const finalResult = context.getFromPath("$.workers.integration-test.result");
    console.log("Final result:", finalResult);
    
    expect(finalResult).toEqual({
        result: "processed_test_value_x3",
        timestamp: 123456789
    });
});

test("Worker handles failure", async () => {
    const context = new JsonPathExecutionContext({});
    
    const failingExec = async () => {
        throw new Error("Processing failed");
    };

    const worker = new WorkerImpl("failing-test")
        .addAspect(new InitLambdaAspect());

    const result = await worker.init(context, failingExec);

    expect(result).toBe("failed");
});

test("Worker with empty aspects still works", async () => {
    const context = new JsonPathExecutionContext({});
    
    const simpleExec = async (input: any) => {
        return { processed: input };
    };

    const worker = new WorkerImpl("simple-test");
    worker.state.input = { data: "simple" };

    const result = await worker.init(context, simpleExec);

    expect(result).toBe("success");
});