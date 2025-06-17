import type { NodeConstructor } from "../core/types";
import { PrintNode } from "./print";
import { StartNode } from "./start";
import { AiRequest } from "./ai-request";
import { SQLQueryNode } from "./sql-query";
import { TemplateInjectorNode } from "./template";
import { RandomStringNode } from "./random";
import { MarkNode } from "./mark";
import { MockNode } from "./mock";

export const nodeMap: Record<string, NodeConstructor> = {
	StartNode: StartNode,
	PrintNode: PrintNode,
	AiRequest: AiRequest,
	SQLQueryNode: SQLQueryNode,
	TemplateInjectorNode: TemplateInjectorNode,
	RandomStringNode: RandomStringNode,
	MarkNode: MarkNode,
};

export default nodeMap;
