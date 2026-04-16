import { useEffect, useState } from "react";
import { useUnit } from "effector-react";
import { HeaderPanelLayout, InfiniteScrollDataTable } from "front-core";
import { Plus, RefreshCw, Trash2 } from "lucide-react";
import {
  $filters,
  $staticStore,
  createStaticMetaClicked,
  filterChanged,
  flushStaticClicked,
  refreshStaticClicked,
  setStatusPatternClicked,
  staticViewMounted,
} from "../domain-static";
import { staticColumns } from "../functions/columns";
import type { StaticContentType, StaticStatus } from "../functions/types";

const emptyValue = "";

export const StaticCacheView = () => {
  const staticState = useUnit($staticStore.$state);
  const filters = useUnit($filters);
  const [search, setSearch] = useState(filters.search ?? emptyValue);

  useEffect(() => {
    staticViewMounted();
  }, []);

  const applyFilters = (next: {
    status?: string;
    contentType?: string;
    search?: string;
  }) => {
    filterChanged({
      status: next.status ? (next.status as StaticStatus) : undefined,
      contentType: next.contentType
        ? (next.contentType as StaticContentType)
        : undefined,
      search: next.search?.trim() || undefined,
    });
  };

  const addTodo = () => {
    const id = window.prompt("Page id");
    if (!id?.trim()) return;
    const contentTypeInput = window.prompt("Content type: html or svg", "html");
    const contentType =
      contentTypeInput === "svg" ? ("svg" as const) : ("html" as const);
    createStaticMetaClicked({ id: id.trim(), contentType });
  };

  const invalidatePattern = () => {
    const pattern = window.prompt("Pattern, for example /catalog/ur/*");
    if (!pattern?.trim()) return;
    const statusInput = window.prompt("Status: todo, loaded or outdated", "outdated");
    const status =
      statusInput === "todo" || statusInput === "loaded"
        ? statusInput
        : "outdated";
    setStatusPatternClicked({ pattern: pattern.trim(), status });
  };

  const headerConfig = {
    title: "Static SSR Cache",
    actions: [
      {
        id: "flush",
        label: "Flush",
        icon: Trash2,
        event: flushStaticClicked,
        variant: "outline" as const,
      },
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshStaticClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              applyFilters({ ...filters, search });
            }
          }}
          placeholder="Search id"
          style={{ minWidth: 260 }}
        />
        <button type="button" onClick={addTodo}>
          <Plus size={14} /> Add todo
        </button>
        <button type="button" onClick={invalidatePattern}>
          Invalidate pattern
        </button>
        <select
          value={filters.status ?? emptyValue}
          onChange={(event) =>
            applyFilters({ ...filters, status: event.target.value, search })
          }
        >
          <option value="">All statuses</option>
          <option value="todo">todo</option>
          <option value="loaded">loaded</option>
          <option value="outdated">outdated</option>
        </select>
        <select
          value={filters.contentType ?? emptyValue}
          onChange={(event) =>
            applyFilters({ ...filters, contentType: event.target.value, search })
          }
        >
          <option value="">All types</option>
          <option value="html">html</option>
          <option value="svg">svg</option>
        </select>
        <button type="button" onClick={() => applyFilters({ ...filters, search })}>
          Apply
        </button>
      </div>
      <InfiniteScrollDataTable
        data={staticState.items}
        hasMore={staticState.hasMore}
        loading={staticState.loading}
        columns={staticColumns}
        onLoadMore={$staticStore.loadMore}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
