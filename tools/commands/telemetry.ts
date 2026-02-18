import { BaseCommandProcessor, type Handler } from "../cli/src/base";
import {
  createTelemetryServiceClient,
  type TelemetryServiceClient,
} from "g-telemetry";

const writeHandler: Handler = async (
  client: TelemetryServiceClient,
  paramSplitter,
  param,
) => {
  const event = {
    device_id: param || "cli-test-device",
    param: "temperature",
    value: Math.round(Math.random() * 100) / 10 + 20,
    unit: "C",
  };

  console.log("Writing telemetry event:", event);
  await client.write(event);
  console.log("Done");
};

const listHandler: Handler = async (
  client: TelemetryServiceClient,
  paramSplitter,
  param,
) => {
  const count = parseInt(param ?? "10");
  const result = await client.listHot({ limit: count, offset: 0 });
  console.log(JSON.stringify(result, null, 2));
};

class TelemetryProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, Handler> {
    return new Map([
      ["write", writeHandler],
      ["list", listHandler],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: TelemetryServiceClient = createTelemetryServiceClient({
    baseUrl,
  });
  return new TelemetryProcessor(client);
};
