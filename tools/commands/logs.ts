import { BaseCommandProcessor, type Handler } from "../cli/src/base";
import { createLogsServiceClient, type LogsServiceClient } from "g-logs";

const writeHandler: Handler = async (
  client: LogsServiceClient,
  paramSplitter,
  param,
) => {
  const event = {
    source: param || "cli-test",
    level: 1,
    code: 100,
    message: `Test log message at ${new Date().toISOString()}`,
  };

  console.log("Writing log event:", event);
  await client.write(event);
  console.log("Done");
};

const listHandler: Handler = async (
  client: LogsServiceClient,
  paramSplitter,
  param,
) => {
  const count = parseInt(param ?? "10");
  const result = await client.listHot({ limit: count, offset: 0 });
  console.log(JSON.stringify(result, null, 2));
};

const statHandler: Handler = async (client: LogsServiceClient) => {
  const stats = await client.getStatistic();
  console.log("\nLogs Statistics:");
  console.log("================");
  console.log(`Hot:      ${stats.totalHot}`);
  console.log(`Cold:     ${stats.totalCold}`);
  console.log(`Errors:   ${stats.errors}`);
  console.log(`Warnings: ${stats.warnings}`);

  if (Object.keys(stats.byLevel).length > 0) {
    console.log("\nBy Level:");
    for (const [level, count] of Object.entries(stats.byLevel)) {
      console.log(`  ${level}: ${count}`);
    }
  }

  if (Object.keys(stats.bySource).length > 0) {
    console.log("\nBy Source:");
    for (const [source, count] of Object.entries(stats.bySource)) {
      console.log(`  ${source}: ${count}`);
    }
  }
};

class LogsProcessor extends BaseCommandProcessor {
  protected initializeCommandMap(): Map<string, Handler> {
    return new Map([
      ["write", writeHandler],
      ["list", listHandler],
      ["stat", statHandler],
    ]);
  }
}

export default () => {
  const baseUrl = process.env.SERVICES_URL;
  const client: LogsServiceClient = createLogsServiceClient({ baseUrl });
  return new LogsProcessor(client);
};
