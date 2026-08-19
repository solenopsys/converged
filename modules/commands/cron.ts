import { BaseCommandProcessor, type Handler, type CommandEntry } from "../cli/src/base";
import { createCliNrpcClientConfig } from "../cli/src/ws";
import {
  createShedullerServiceClient,
  type ShedullerServiceClient,
} from "g-sheduller/browser";

const listHandler: Handler = async (client: ShedullerServiceClient) => {
  const result = await client.listCrons({ offset: 0, limit: 100 });
  console.log(JSON.stringify(result, null, 2));
};

const providersHandler: Handler = async (client: ShedullerServiceClient) => {
  const result = await client.listProviders();
  console.log(JSON.stringify(result, null, 2));
};

class ShedullerProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, CommandEntry> {
    return new Map([
      ["list", { handler: listHandler, description: "List all scheduled cron jobs" }],
      ["providers", { handler: providersHandler, description: "List available scheduler providers" }],
    ]);
  }
}

export default () => {
  const client: ShedullerServiceClient = createShedullerServiceClient(createCliNrpcClientConfig());
  return new ShedullerProcessor(client);
};
