import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BaseCommandProcessor, type CommandEntry, type Handler, printJson } from "../cli/src/base";
import { createFunctionsServiceClient, type FunctionsServiceClient, type FunctionInput } from "g-functions";

type Client = { functions: FunctionsServiceClient };

function resolveBaseUrl(): string {
  return (
    process.env.SERVICES_URL ||
    process.env.SERVICES_BASE ||
    "http://127.0.0.1:3000/services"
  ).replace(/\/+$/, "");
}

function resolveHeaders(): Record<string, string> {
  const token = process.env.SERVICE_TOKEN?.trim();
  return token ? { authorization: `Bearer ${token}` } : {};
}

// push --catalog=./commands-catalog.json
const pushHandler: Handler = async (client: Client, _splitter, param) => {
  const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
  let catalogPath: string | undefined;

  for (const part of parts) {
    if (part.startsWith("--catalog=")) {
      catalogPath = part.slice("--catalog=".length);
    } else if (!part.startsWith("--")) {
      catalogPath = part;
    }
  }

  if (!catalogPath) {
    console.error("Usage: functions push --catalog=<path-to-catalog.json>");
    process.exit(1);
  }

  const absPath = resolve(catalogPath);
  let functions: FunctionInput[];
  try {
    functions = JSON.parse(readFileSync(absPath, "utf8")) as FunctionInput[];
  } catch (err) {
    console.error(`Failed to read catalog from ${absPath}:`, err);
    process.exit(1);
  }

  if (!Array.isArray(functions) || functions.length === 0) {
    console.error("Catalog must be a non-empty JSON array of FunctionInput objects");
    process.exit(1);
  }

  console.log(`Pushing ${functions.length} functions to ms-functions…`);
  await client.functions.registerFunctions(functions);
  console.log(`✅ Registered ${functions.length} functions`);
};

// list [--type=front|back] [--category=name]
const listHandler: Handler = async (client: Client, _splitter, param) => {
  const parts = (param ?? "").trim().split(/\s+/).filter(Boolean);
  let type: "front" | "back" | undefined;
  let category: string | undefined;

  for (const part of parts) {
    if (part.startsWith("--type=")) type = part.slice("--type=".length) as "front" | "back";
    if (part.startsWith("--category=")) category = part.slice("--category=".length);
  }

  const functions = await client.functions.listFunctions(type, category);
  console.log(`${functions.length} functions:`);
  printJson(functions);
};

// search <query>
const searchHandler: Handler = async (client: Client, _splitter, param) => {
  const query = (param ?? "").trim();
  if (!query) {
    console.error("Usage: functions search <query>");
    process.exit(1);
  }

  const results = await client.functions.searchFunctions(query, 10);
  console.log(`Top ${results.length} results for "${query}":`);
  printJson(results);
};

// delete <id>
const deleteHandler: Handler = async (client: Client, _splitter, param) => {
  const id = (param ?? "").trim();
  if (!id) {
    console.error("Usage: functions delete <id>");
    process.exit(1);
  }
  await client.functions.deleteFunction(id);
  console.log(`✅ Deleted function: ${id}`);
};

class FunctionsProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["push", { handler: pushHandler, description: "Push catalog JSON to ms-functions (--catalog=<path>)" }],
      ["list", { handler: listHandler, description: "List registered functions [--type=front|back] [--category=name]" }],
      ["search", { handler: searchHandler, description: "Semantic search over registered functions" }],
      ["delete", { handler: deleteHandler, description: "Delete a function by id" }],
    ]);
  }
}

export default () => {
  const baseUrl = resolveBaseUrl();
  const headers = resolveHeaders();
  const functions = createFunctionsServiceClient({ baseUrl, headers });
  return new FunctionsProcessor({ functions });
};
