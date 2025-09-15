import { ReactNode } from "react";
import { Slot } from "converged-core";

export const DashboardLayout = ({ 
  children,
  basePath = "dashboard",
  groups = ["acquisition", "retention"] 
}: { 
  children?: ReactNode;
  basePath?: string;
  groups?: string[];
}) => {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Закрепленная область */}
      <div className="sticky top-0 z-10 bg-background/80 backdrop-blur border-b px-4 py-3">
        <Slot id={`${basePath}:pinned`} />
      </div>
      
      {/* Динамические группы */}
      {groups.map(group => (
        <section key={group} className="px-4 py-3">
          <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase">
            {group}
          </h3>
          <Slot id={`${basePath}:group:${group}`} />
        </section>
      ))}
      
      {/* Основная область */}
      <div className="px-4 py-3">
        <Slot id={`${basePath}:main`} />
      </div>
      
      {children}
    </div>
  );
};
