import React from "react";

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/ui/table/DataTable";
import { SectionCards } from "@/components/section-cards";

import { useTranslation } from "react-i18next";

function Panel() {
  const { i18n } = useTranslation();
  
  // Get the table data directly from i18n resources based on current language
  const tableData = i18n.getResource(i18n.language, 'table_data') || [];
  
  return (

    <div className="flex flex-1 flex-col">
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 md:gap-6">
        <SectionCards />
   
          <ChartAreaInteractive />
       
        <DataTable data={tableData} />
      </div>
    </div>
  </div>
  );
}

export default Panel;