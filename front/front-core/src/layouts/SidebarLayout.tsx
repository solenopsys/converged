import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export const SidebarLayout = () => {
	return (
		<Suspense fallback={<div>Loading...</div>}>
			<SidebarProvider>
				<div className="flex min-h-screen w-full">
					<AppSidebar variant="inset" />
					<SidebarInset className="flex-1 w-full">
						<SiteHeader />
						<main className="flex-1 w-full px-4 lg:px-6">
							<div className="w-full py-4 md:py-6">
								<Outlet />
							</div>
						</main>
					</SidebarInset>
				</div>
			</SidebarProvider>
		</Suspense>
	);
};