import { Outlet } from "react-router-dom";

export const SimpleLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<div className="min-h-screen w-full bg-background">
			<main className="w-full">
				{children}
			</main>
		</div>
	);
};