import type { Row } from "bun-transport";
import type { GraphStore } from "./graph-store";

type GraphProperties = Record<string, unknown>;

function identifier(value: string): string {
	if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
		throw new Error(`Invalid graph identifier: ${value}`);
	}
	return value;
}

function literal(value: unknown): string {
	if (value === null || value === undefined) return "null";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("Graph numbers must be finite");
		return String(value);
	}
	if (typeof value === "boolean") return String(value);
	if (typeof value === "string") {
		return `'${value
			.replaceAll("\\", "\\\\")
			.replaceAll("'", "\\'")
			.replaceAll("\n", "\\n")
			.replaceAll("\r", "\\r")
			.replaceAll("\t", "\\t")}'`;
	}
	if (Array.isArray(value)) return `[${value.map(literal).join(", ")}]`;
	if (typeof value === "object") {
		return `{ ${Object.entries(value as GraphProperties)
			.map(([key, item]) => `${identifier(key)}: ${literal(item)}`)
			.join(", ")} }`;
	}
	throw new Error(`Unsupported graph value: ${typeof value}`);
}

/** CRUD operations shared by repositories for one graph node label. */
export class BaseRepositoryGraph<TEntity extends object> {
	private readonly safeLabel: string;
	private readonly safeKey: string[];

	constructor(
		protected readonly store: GraphStore,
		label: string,
		key: (keyof TEntity & string)[],
	) {
		this.safeLabel = identifier(label);
		this.safeKey = key.map(identifier);
		if (this.safeKey.length === 0) {
			throw new Error("Graph repository requires at least one key property");
		}
	}

	create(entity: TEntity): void {
		this.store.exec(
			`CREATE (node:${this.safeLabel} ${literal(entity as unknown as GraphProperties)})`,
		);
	}

	findByKey(key: Partial<TEntity>): Row[] {
		return this.store.query(
			`MATCH (node:${this.safeLabel} ${literal(this.keyProperties(key))}) RETURN node`,
		);
	}

	findAll(limit = 100): Row[] {
		if (!Number.isInteger(limit) || limit < 1) {
			throw new Error("Graph repository limit must be a positive integer");
		}
		return this.store.query(
			`MATCH (node:${this.safeLabel}) RETURN node LIMIT ${limit}`,
		);
	}

	updateByKey(key: Partial<TEntity>, patch: Partial<TEntity>): void {
		this.store.exec(
			`MATCH (node:${this.safeLabel} ${literal(this.keyProperties(key))}) SET node += ${literal(patch as unknown as GraphProperties)}`,
		);
	}

	deleteByKey(key: Partial<TEntity>): void {
		this.store.exec(
			`MATCH (node:${this.safeLabel} ${literal(this.keyProperties(key))}) DETACH DELETE node`,
		);
	}

	private keyProperties(key: Partial<TEntity>): GraphProperties {
		const properties: GraphProperties = {};
		for (const field of this.safeKey) {
			if (!Object.prototype.hasOwnProperty.call(key, field)) {
				throw new Error(`Missing graph repository key: ${field}`);
			}
			properties[field] = (key as unknown as GraphProperties)[field];
		}
		return properties;
	}
}
