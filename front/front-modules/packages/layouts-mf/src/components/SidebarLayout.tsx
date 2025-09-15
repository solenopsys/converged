import { ReactNode, Suspense } from "react";
import { Slot, SidebarProvider } from "converged-core";
import { AppSidebar } from "converged-core";

export const SidebarLayout = ({
  children,
  basePath = "sidebar"
}: {
  children?: ReactNode;
  basePath?: string;
}) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <div className="flex min-h-screen w-full">
        <aside className="w-64 bg-muted/40">
          <SidebarProvider>
            <AppSidebar basePath={basePath} >
              <Slot id={`${basePath}:left`} />
            </AppSidebar>
          </SidebarProvider>
        </aside>
        <div className="flex-1">
          <header className="border-b p-4">
            <Slot id={`${basePath}:header`} />
          </header>
          <main className="flex-1 p-4">
            <Slot id={`${basePath}:center`} />
          </main>
        </div>
      </div>
      {children}
    </Suspense>
  );
};