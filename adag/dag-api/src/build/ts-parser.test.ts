import { test, expect } from "bun:test";
import { extractConstructorParams } from "./ts-parser";

test("test one", () => {
  const code = `import { type INode } from "dag-api";

export default class PrintNode implements INode {
	public scope!: string;

	constructor(public name: string) {}

	async execute(data: any): Promise<any> {
		
	}
}
`;

  const result = extractConstructorParams(code);

  expect(result).toEqual([
    { name: "name", type: "string" }
  ]);
});

test("extractConstructorParams - basic public parameters", () => {
  const code = `import { type INode,type ContextAccessor,processTemplate } from "dag-api";

interface HttpNodeConfig {
	url: string;
	method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
	headers?: Record<string, string>;
	timeout?: number;
	followRedirects?: boolean;
}

export default class HttpNode implements INode {
	public name: string;
	private config: HttpNodeConfig;
	private body: any;

	constructor(name: string, params: HttpNodeConfig, body?: any) {
	 
	}

	async execute(data: any, accessor: ContextAccessor): Promise<any> {

	}
}
`;

  const result = extractConstructorParams(code);

  expect(result).toEqual([
    { name: "name", type: "string" },
    { name: "params", type: "any" },
    { name: "body", type: "any" }
  ]);
});

test("extractConstructorParams - parameters with default values", () => {
  const code = `import { type INode } from "dag-api";

const CharsetPresets = {
  ALPHANUMERIC: 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
};

export default class RandomStringNode implements INode {
  public scope!: string;

  constructor(
    public name: string,
    length: number = 10,
    charset: string = CharsetPresets.ALPHANUMERIC,
  ) {}

  async execute(data: any): Promise<any> {
    
  }
}
`;

  const result = extractConstructorParams(code);

  expect(result).toEqual([
    { name: "name", type: "string" },
    { name: "length", type: "number" },
    { name: "charset", type: "string" }
  ]);
});