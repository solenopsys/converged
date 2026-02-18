import type { INode } from "../dag-api";

import { AiRequest } from "./ai-request";
import { HtmlCleanNode } from "./html-cleaner";
import HttpNode from "./http";
import MarkNode from "./mark";
import { MergeNode } from "./merge";
import RandomStringNode from "./random";
import BulkInsertNode from "./sql-bulk-insert";
import SQLQueryNode from "./sql-query";
import TemplateInjectorNode from "./template";

export type NodeParam = { name: string; type: string };

export type NodeDefinition = {
  ctor: new (...args: any[]) => INode;
  params: NodeParam[];
};

export const NODE_DEFINITIONS: Record<string, NodeDefinition> = {
  "ai-request": {
    ctor: AiRequest,
    params: [
      { name: "name", type: "string" },
      { name: "config", type: "object" },
      { name: "provider", type: "string" },
      { name: "wrapName", type: "string" },
      { name: "decodeJson", type: "boolean" },
    ],
  },
  "html-cleaner": {
    ctor: HtmlCleanNode,
    params: [{ name: "name", type: "string" }],
  },
  http: {
    ctor: HttpNode,
    params: [
      { name: "name", type: "string" },
      { name: "url", type: "string" },
      { name: "method", type: "string" },
      { name: "body", type: "any" },
    ],
  },
  mark: {
    ctor: MarkNode,
    params: [
      { name: "name", type: "string" },
      { name: "convertToHtml", type: "boolean" },
    ],
  },
  merge: {
    ctor: MergeNode,
    params: [
      { name: "name", type: "string" },
      { name: "expectedSources", type: "string[]" },
    ],
  },
  random: {
    ctor: RandomStringNode,
    params: [
      { name: "name", type: "string" },
      { name: "length", type: "number" },
      { name: "charset", type: "string" },
    ],
  },

  "sql-bulk-insert": {
    ctor: BulkInsertNode,
    params: [
      { name: "name", type: "string" },
      { name: "tableName", type: "string" },
      { name: "columnMapping", type: "object" },
      { name: "provider", type: "string" },
      { name: "updateOnConflict", type: "boolean" },
    ],
  },
  "sql-query": {
    ctor: SQLQueryNode,
    params: [
      { name: "name", type: "string" },
      { name: "query", type: "string" },
      { name: "provider", type: "string" },
    ],
  },
  template: {
    ctor: TemplateInjectorNode,
    params: [
      { name: "name", type: "string" },
      { name: "config", type: "object" },
    ],
  },
};

export function getNodeDefinition(name: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS[name];
}

export function listNodeNames(): string[] {
  return Object.keys(NODE_DEFINITIONS);
}
