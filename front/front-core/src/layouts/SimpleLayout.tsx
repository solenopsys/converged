import { Outlet } from "react-router-dom";

export const SimpleLayout = () => {
	return (
		<div className="min-h-screen w-full bg-background">
			<main className="w-full">
				<Outlet />
			</main>
		</div>
	);
};