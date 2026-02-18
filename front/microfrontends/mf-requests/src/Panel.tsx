import React from "react";

import { ChartAreaInteractive, SectionCards, useGlobalTranslation } from "front-core";

function Panel() {
  const { i18n } = useGlobalTranslation();

  // Get the table data directly from i18n resources based on current language
  const tableData = i18n.getResource(i18n.language, 'table_data') || [];

  return (

    <div className="flex flex-1 flex-col">
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 md:gap-6">
        <SectionCards />

          <ChartAreaInteractive />

        {/* TODO: Replace with InfiniteScrollDataTable or remove demo */}
        <div className="p-4 border rounded-lg">
          <p className="text-sm text-muted-foreground">Table removed - use InfiniteScrollDataTable for new implementations</p>
        </div>
      </div>
    </div>
  </div>
  );
}

export default Panel;
