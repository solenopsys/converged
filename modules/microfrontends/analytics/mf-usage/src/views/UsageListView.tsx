import { createDomain } from "effector";
import { createInfiniteTableStore, EntityListView } from "front-core";
import type { SetRef } from "front-core/object-runtime";
import type { UsageListParams } from "g-usage";
import { useMemo } from "preact/hooks";
import usage from "../service";
import { usageColumns } from "../functions/columns";

export const UsageListView = ({ reference }: { reference?: SetRef }) => {
  const store = useMemo(() => {
    const domain = createDomain(`usage-${crypto.randomUUID()}`);
    return createInfiniteTableStore(domain, (params) =>
      usage.listUsage(params as UsageListParams),
    );
  }, []);
  const filter =
    reference?.kind === "set" && reference.selection.kind === "query"
      ? reference.selection.filter
      : undefined;

  return (
    <EntityListView
      tableId="usage"
      title="Usage events"
      store={store}
      columns={usageColumns}
      baseFilters={filter ? { filter } : undefined}
    />
  );
};

export default UsageListView;
