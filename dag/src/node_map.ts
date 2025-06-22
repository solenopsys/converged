import type { NodeConstructor } from "./core/types";
import { PrintNode } from "./nodes/print";
import { StartNode } from "./nodes/start";
import { AiRequest } from "./nodes/ai-request";
import { SQLQueryNode } from "./nodes/sql-query";
import { TemplateInjectorNode } from "./nodes/template";
import { RandomStringNode } from "./nodes/random";
import { MarkNode } from "./nodes/mark";
import { MockNode } from "./nodes/mock";

export const nodeMap: Record<string, string> = {
	StartNode: "start",
	PrintNode: "print",
	AiRequest: "ai-request",
	SQLQueryNode: "sql-query",
	TemplateInjectorNode: "template",
	RandomStringNode: "random",
	MarkNode: "mark",
};

export default nodeMap;
