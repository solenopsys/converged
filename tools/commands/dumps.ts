import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";
import { createDumpsServiceClient, type DumpsServiceClient } from "g-dumps";

const listHandler: Handler = async (client: DumpsServiceClient) => {
  const result = await client.listStorages();
  console.log(JSON.stringify(result, null, 2));
};

const dumpHandler: Handler = async (
  client: DumpsServiceClient,
  _paramSplitter,
  param,
) => {
  const result = await client.dump(param);
  console.log(JSON.stringify(result, null, 2));
};

const linkHandler: Handler = async (
  client: DumpsServiceClient,
  _paramSplitter,
  param,
) => {
  if (!param) {
    console.log("Usage: bun cli dumps link <fileName>");
    return;
  }
  const result = await client.getLink(param);
  console.log(result);
};

class DumpsProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["list", { handler: listHandler, description: "List all available dump storages" }],
      ["dump", { handler: dumpHandler, description: "Create a dump of the specified storage" }],
      ["link", { handler: linkHandler, description: "Get a download link for a dump file" }],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: DumpsServiceClient = createDumpsServiceClient({ baseUrl });
  return new DumpsProcessor(client);
};
