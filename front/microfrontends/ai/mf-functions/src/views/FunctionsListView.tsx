import React, { useEffect } from "react";
import { useUnit } from "effector-react";
import { HeaderPanel } from "front-core";
import { RefreshCw, Play, Search, Cpu, Monitor } from "lucide-react";
import type { FunctionDef, FunctionSearchResult } from "g-functions";
import {
  $remoteFunctions,
  $searchResults,
  $searchQuery,
  $isLoading,
  $isSearching,
  functionsMounted,
  refreshClicked,
  searchChanged,
  executeClicked,
} from "../domain";

type FunctionRow = Pick<FunctionDef, "id" | "brief" | "description" | "category" | "type"> & { score?: number };

export const FunctionsListView = ({ bus: _bus }) => {
  const remoteFunctions = useUnit($remoteFunctions);
  const searchResults = useUnit($searchResults);
  const searchQuery = useUnit($searchQuery);
  const isLoading = useUnit($isLoading);
  const isSearching = useUnit($isSearching);

  useEffect(() => {
    functionsMounted();
  }, []);

  const rows: FunctionRow[] = searchResults
    ? searchResults
    : remoteFunctions;

  const headerConfig = {
    title: "Functions",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <HeaderPanel config={headerConfig} />

      <div className="p-4 border-b">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search functions by meaning…"
            value={searchQuery}
            onChange={(e) => searchChanged(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-md bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="text-sm text-muted-foreground mb-4 flex items-center gap-2">
          {(isLoading || isSearching) && (
            <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          )}
          <span>{rows.length} functions</span>
        </div>

        <div className="space-y-2">
          {rows.map((fn) => (
            <FunctionRow key={fn.id} fn={fn} onExecute={(id) => executeClicked({ id })} />
          ))}
        </div>

        {rows.length === 0 && !isLoading && (
          <div className="text-center text-muted-foreground py-8">No functions found</div>
        )}
      </div>
    </div>
  );
};

const FunctionRow = ({
  fn,
  onExecute,
}: {
  fn: FunctionRow;
  onExecute: (id: string) => void;
}) => (
  <div className="p-3 border rounded-lg hover:bg-muted/50 transition-colors">
    <div className="flex items-start justify-between gap-2">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-sm font-medium truncate">{fn.id}</span>
          {fn.category && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
              {fn.category}
            </span>
          )}
          <span
            className={`text-xs px-1.5 py-0.5 rounded flex items-center gap-1 ${
              fn.type === "front" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
            }`}
          >
            {fn.type === "front" ? <Monitor className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
            {fn.type}
          </span>
          {fn.score !== undefined && (
            <span className="text-xs text-muted-foreground">
              {Math.round(fn.score * 100)}%
            </span>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1 line-clamp-2">{fn.brief || fn.description}</div>
      </div>
      {fn.type === "front" && (
        <button
          onClick={() => onExecute(fn.id)}
          className="flex-shrink-0 p-2 rounded-md hover:bg-primary/20 text-primary"
          title="Execute"
        >
          <Play className="h-4 w-4" />
        </button>
      )}
    </div>
  </div>
);
