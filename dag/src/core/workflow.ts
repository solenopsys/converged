// workflow.ts - исправлена работа с конфигурацией
import type { INode, NodeMap, WorkflowConfig } from "./types";
import { v4 as uuidv4 } from "uuid";
import { Store } from "./store";
import { Accessor } from "../libs/accessor";
import { loadClassByName } from "../libs/loader";

// Функция для создания экземпляра класса с инжекцией полей
function createInstance(ClassConstructor: any, fieldsObject: any) {
	// Получаем параметры конструктора через toString и парсинг
	const constructorString = ClassConstructor.toString();
	const paramMatch = constructorString.match(/constructor\s*\(([^)]*)\)/);

	if (!paramMatch) {
		throw new Error("Не удалось найти конструктор");
	}

	// Извлекаем имена параметров
	const paramNames = paramMatch[1]
		.split(",")
		.map((param) => param.trim().split(/\s+/)[0])
		.filter((name) => name);

	// Создаем массив значений в порядке параметров конструктора
	const values = paramNames.map((paramName) => fieldsObject[paramName]);

	// Создаем экземпляр с spread оператором
	return new ClassConstructor(...values);
}

export class Workflow {
	public readonly uuid: string;
	private nodes: Map<string, INode>;
	private connections: Map<string, string[]>;
	private storage: Store;
	private accessor: Accessor;

	constructor(
		constructorMap: NodeMap,
		workflowConfig: WorkflowConfig,
		storage: Store,
	) {
		this.uuid = uuidv4();
		this.storage = storage;

		// Исправлено: создаем инстансы из конфигурации
		this.nodes = new Map();
		for (const [name, nodeCfg] of workflowConfig.nodes) {

			const fileName = constructorMap[nodeCfg.type]
				const NodeClass =loadClassByName(fileName);
			if (!NodeClass) {
				throw new Error(`Unknown node type: ${nodeCfg.type}`);
			}
			console.log("NEDEID", name, nodeCfg.params);
			this.nodes.set(
				name,
				createInstance(NodeClass, { name, ...nodeCfg.params }),
			);
		}
		this.accessor = new Accessor(this.storage, this.uuid);

		this.connections = new Map(workflowConfig.connections);
	}

	// Исправлено: принимаем данные напрямую, а не dataId
	async executeNode(nodeId: string, data: unknown): Promise<unknown> {
		const node = this.nodes.get(nodeId);
		if (!node) throw new Error(`Node not found: ${nodeId}`);

		return await node.execute(data, this.accessor);
	}

	// Исправлено: работаем с данными напрямую
	async execute(startNode: string, initData: unknown): Promise<unknown> {
		const done = new Set<string>();
		const queue = [{ nodeId: startNode, data: initData }];
		let lastResult = initData;

		while (queue.length) {
			const { nodeId, data } = queue.shift()!;
			console.log("PROCESS", nodeId);
			if (done.has(nodeId)) continue;

			lastResult = await this.executeNode(nodeId, data);
			console.log("LASTPROCESS RESULT", lastResult);
			done.add(nodeId);
			this.storage.save(this.uuid, nodeId, lastResult);

			for (const next of this.connections.get(nodeId) ?? []) {
				if (!done.has(next)) queue.push({ nodeId: next, data: lastResult });
			}
		}
		return lastResult;
	}

	getConfig(): WorkflowConfig {
		return {
			nodes: new Map(this.nodes),
			connections: new Map(this.connections),
		};
	}
}
