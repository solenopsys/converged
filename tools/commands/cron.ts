import { BaseCommandProcessor, type Handler } from "../cli/src/base";
import {
  createShedullerServiceClient,
  type ShedullerServiceClient,
} from "g-sheduller";

const listHandler: Handler = async (client: ShedullerServiceClient) => {
  const result = await client.listCrons({ offset: 0, limit: 100 });
  console.log(JSON.stringify(result, null, 2));
};

const providersHandler: Handler = async (client: ShedullerServiceClient) => {
  const result = await client.listProviders();
  console.log(JSON.stringify(result, null, 2));
};

class ShedullerProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, Handler> {
    return new Map([
      ["list", listHandler],
      ["providers", providersHandler],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: ShedullerServiceClient = createShedullerServiceClient({
    baseUrl,
  });
  return new ShedullerProcessor(client);
};
