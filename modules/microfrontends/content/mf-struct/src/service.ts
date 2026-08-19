import { createFrontNrpcClientConfig } from "signal-channel";
import { createStructServiceClient } from "g-struct";
import type { PaginationParams, StructFile } from "./functions/types";

const structClient = createStructServiceClient(createFrontNrpcClientConfig());

async function listOfStruct(params: PaginationParams): Promise<{ items: StructFile[]; totalCount?: number }> {
  const result = await structClient.listJson(params);
  const paths = Array.isArray(result?.items) ? result.items : [];

  return {
    items: paths.map((path: string) => ({ path, content: "" })),
    totalCount: typeof result?.totalCount === "number" ? result.totalCount : paths.length,
  };
}

export default {
  listOfStruct,
};
