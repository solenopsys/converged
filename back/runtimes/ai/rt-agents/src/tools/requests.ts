import { createRequestsServiceClient } from "g-requests";
import type { Tool } from "../agent/tools/base";

function client() {
  return createRequestsServiceClient({ baseUrl: process.env.SERVICES_BASE });
}

export const getRequestTool: Tool = {
  name: "get_request",
  description: "Get current state of a request: filled fields, missing required fields, completion percentage, and process type.",
  parameters: {
    type: "object",
    properties: {
      requestId: { type: "string", description: "Request ID" },
    },
    required: ["requestId"],
  },
  async execute({ requestId }) {
    const model = await client().getRequestModel(requestId as string);
    return JSON.stringify({
      id: model.id,
      status: model.status,
      processType: model.processType,
      completion: model.completion,
      missingRequired: model.missingRequired,
      remainingRequired: model.remainingRequired,
      fields: Object.fromEntries(
        Object.entries(model.fields).map(([k, f]: [string, any]) => [
          k,
          { value: f.value, status: f.status, required: f.required, label: f.label },
        ])
      ),
    });
  },
};

export const updateRequestFieldsTool: Tool = {
  name: "update_request_fields",
  description: "Update fields of a request with values extracted from the user. Only pass fields you are confident about.",
  parameters: {
    type: "object",
    properties: {
      requestId: { type: "string", description: "Request ID" },
      fields: {
        type: "object",
        description: "Key-value pairs of field names and their values",
        additionalProperties: true,
      },
      comment: { type: "string", description: "Optional comment describing what was updated" },
    },
    required: ["requestId", "fields"],
  },
  async execute({ requestId, fields, comment }) {
    const model = await client().applyRequestUpdate(
      requestId as string,
      { parameters: fields as Record<string, any> },
      "agent",
      (comment as string) ?? undefined,
    );
    return JSON.stringify({
      completion: model.completion,
      missingRequired: model.missingRequired,
      updatedFields: Object.keys(fields as object),
    });
  },
};

export const createRequestTool: Tool = {
  name: "create_request",
  description: "Create a new request. Use when the user wants to submit a new order (CNC machining, 3D printing, laser cutting, etc.).",
  parameters: {
    type: "object",
    properties: {
      source: { type: "string", description: "Short description or title of the request" },
      fields: {
        type: "object",
        description: "Initial field values known at creation time",
        additionalProperties: true,
      },
    },
    required: ["source"],
  },
  async execute({ source, fields }) {
    const id = await client().createRequest({
      source: source as string,
      fields: (fields as Record<string, any>) ?? {},
    });
    return JSON.stringify({ requestId: id });
  },
};

export const requestTools: Tool[] = [
  getRequestTool,
  updateRequestFieldsTool,
  createRequestTool,
];
