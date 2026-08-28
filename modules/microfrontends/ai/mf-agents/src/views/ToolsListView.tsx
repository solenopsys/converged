import React, { useEffect, useState } from "preact/compat";
import { createDomain } from "effector";
import { HeaderPanelLayout, InfiniteScrollDataTable, useMicrofrontendTranslation } from "front-core";
import { RefreshCw } from "front-core";
import { agentClient } from "../services";
import { toolsColumns } from "../config";
import type { ToolDefinition } from "../types";

const domain = createDomain("agents-tools");
const refreshToolsClicked = domain.createEvent("REFRESH_TOOLS_CLICKED");
const MF_ID = "agents-mf";

export const ToolsListView = ({ bus }) => {
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const { t } = useMicrofrontendTranslation(MF_ID);
  const [loading, setLoading] = useState(false);

  const loadTools = async () => {
    setLoading(true);
    try {
      const result = await agentClient.listTools();
      setTools(result || []);
    } catch (e) {
      console.error("Failed to load tools:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTools();
    const unwatch = refreshToolsClicked.watch(() => loadTools());
    return () => unwatch();
  }, []);

  const headerConfig = {
    title: "Tools",
    actions: [
      {
        id: "refresh",
        label: "Refresh",
        icon: RefreshCw,
        event: refreshToolsClicked,
        variant: "outline" as const,
      },
    ],
  };

  return (
    <HeaderPanelLayout config={headerConfig}>
      <InfiniteScrollDataTable
        data={tools}
        hasMore={false}
        loading={loading}
        columns={toolsColumns(t)}
        viewMode="table"
      />
    </HeaderPanelLayout>
  );
};
