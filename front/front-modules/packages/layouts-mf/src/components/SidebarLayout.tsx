import { ReactNode, Suspense } from "react";
import { Slot, SidebarProvider } from "converged-core";
import { AppSidebar } from "converged-core";
import {   SidebarInset, SidebarTrigger, Sidebar } from "converged-core";

export const SidebarLayout = ({
  children,
  basePath = "sidebar"
}: {
  children?: ReactNode;
  basePath?: string;
}) => {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SidebarProvider style={{ "--sidebar-width": "30rem" }}>
        <div className="flex min-h-screen w-full">
          <aside className="w-64 bg-muted/40">
            <SidebarProvider>
              <AppSidebar basePath={basePath} >
                <Slot id={`${basePath}:left`} />
              </AppSidebar>
            </SidebarProvider>
          </aside>
          <SidebarInset>
            <header className="border-b p-4 flex items-center gap-2">
              <SidebarTrigger />
              <Slot id={`${basePath}:header`} />
            </header>
            <main className="flex-1 p-4">
              <Slot id={`${basePath}:center`} />
            </main>
          </SidebarInset>
          {children}
          <Sidebar side="right" variant="inset"      collapsible="offcanvas" >
            <Slot id={`${basePath}:right`} />
          </Sidebar>
        </div>
      </SidebarProvider>
    </Suspense>
  );
};