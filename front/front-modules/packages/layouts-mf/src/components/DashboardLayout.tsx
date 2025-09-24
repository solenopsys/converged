import { ReactNode, useEffect } from "react";
import { Slot, dashboardSlots, layoutReady } from "converged-core";
 

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* остальной код без изменений */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b p-4">
        <div className="space-y-4">
          {dashboardSlots.list.map(slotId => {
            console.log("RENDER FIXED SLOT", slotId);
            return <Slot key={slotId} id={`${basePath}:${slotId}`} />
          })}
        </div>
      </div>

      <div className="space-y-6 p-4">
        {groups.map(group => (
          <section key={group} className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
              {group}
            </h3>
            <Slot id={`${basePath}:group:${group}`} />
          </section>
        ))}

        <div className="space-y-4">
          <Slot id={`${basePath}:main`} />
        </div>

        {children}
      </div>
    </div>
  );
};