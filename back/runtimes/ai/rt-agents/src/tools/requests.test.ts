import { describe, test, expect, mock } from "bun:test";

const fakeModel = {
  id: "req-1",
  status: "new",
  processType: "cnc_machining",
  completion: { percent: 40, filled: 2, total: 5 },
  missingRequired: ["material", "tolerance"],
  remainingRequired: ["material", "tolerance", "quantity"],
  fields: {
    material: { value: null, status: "missing", required: true, label: "Material" },
    thickness: { value: "10mm", status: "filled", required: true, label: "Thickness" },
  },
};

mock.module("g-requests", () => ({
  createRequestsServiceClient: () => ({
    getRequestModel: async (id: string) => ({ ...fakeModel, id }),
    applyRequestUpdate: async (_id: string, patch: any, _actor: string, _comment?: string) => ({
      ...fakeModel,
      completion: { percent: 60, filled: 3, total: 5 },
      missingRequired: ["tolerance"],
    }),
    createRequest: async (input: any) => "new-req-id",
  }),
}));

import { getRequestTool, updateRequestFieldsTool, createRequestTool } from "./requests";

describe("get_request tool", () => {
  test("returns serialized request model", async () => {
    const result = JSON.parse(await getRequestTool.execute({ requestId: "req-1" }));
    expect(result.id).toBe("req-1");
    expect(result.processType).toBe("cnc_machining");
    expect(result.missingRequired).toContain("material");
    expect(result.completion.percent).toBe(40);
  });

  test("includes fields with value and status", async () => {
    const result = JSON.parse(await getRequestTool.execute({ requestId: "req-1" }));
    expect(result.fields.thickness).toMatchObject({ value: "10mm", status: "filled" });
    expect(result.fields.material).toMatchObject({ value: null, status: "missing" });
  });
});

describe("update_request_fields tool", () => {
  test("returns updated completion and missing fields", async () => {
    const result = JSON.parse(await updateRequestFieldsTool.execute({
      requestId: "req-1",
      fields: { material: "aluminum" },
      comment: "user specified material",
    }));
    expect(result.completion.percent).toBe(60);
    expect(result.missingRequired).toEqual(["tolerance"]);
    expect(result.updatedFields).toContain("material");
  });

  test("works without comment", async () => {
    const result = JSON.parse(await updateRequestFieldsTool.execute({
      requestId: "req-1",
      fields: { quantity: 5 },
    }));
    expect(result.updatedFields).toContain("quantity");
  });
});

describe("create_request tool", () => {
  test("returns new requestId", async () => {
    const result = JSON.parse(await createRequestTool.execute({ source: "CNC part" }));
    expect(result.requestId).toBe("new-req-id");
  });

  test("works with initial fields", async () => {
    const result = JSON.parse(await createRequestTool.execute({
      source: "3D print",
      fields: { material: "PLA" },
    }));
    expect(result.requestId).toBeDefined();
  });
});
