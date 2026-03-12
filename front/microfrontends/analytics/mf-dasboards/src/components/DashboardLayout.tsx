import { ReactNode, useEffect } from "react";
import {
  Slot,
  dashboardSlots,
  layoutReady,
  HeaderPanel,
  DashboardWidget,
} from "front-core";


export const DashboardLayout = ({
  children,
  basePath = "dashboard",
  groups = ["acquisition", "retention"]
}: {
  children?: ReactNode;
  basePath?: string;
  groups?: string[];
}) => {

  useEffect(() => {
    // При монтировании dashboard
    layoutReady("dashboard");
    dashboardSlots.restoreWidgets();

    return () => {
      // При размонтировании dashboard
      dashboardSlots.saveWidgets();
    };
  }, []);

  const headerConfig = {
    title: 'Dashboard'
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <HeaderPanel config={headerConfig} />
      <div className="flex-1 min-h-0 overflow-auto p-4">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4 auto-rows-[200px]">
          {dashboardSlots.list.map((slotId, index) => {
            const spanClass =
              index === 0
                ? "md:col-span-4 md:row-span-2"
                : "md:col-span-2";
            return (
              <DashboardWidget key={slotId} className={spanClass}>
                <Slot id={`${basePath}:${slotId}`} />
              </DashboardWidget>
            );
          })}
        </div>
      </div>
    </div>
  );
};
