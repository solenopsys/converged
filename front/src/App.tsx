import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { routeConfig } from "./routes.config";
import { SidebarLayout } from "./layouts/SidebarLayout";
import { SimpleLayout } from "./layouts/SimpleLayout";

function App() {
	// Разделяем роуты на группы по layout'ам
	const sidebarRoutes = routeConfig.filter(route => route.protected);
	const simpleRoutes = routeConfig.filter(route => !route.protected);

	const createRouteElement = ({ component, element, protected: isProtected }) => {
		if (element) return element;
		
		if (component) {
			const LazyComponent = lazy(component);
			return isProtected ? (
				<ProtectedRoute>
					<LazyComponent />
				</ProtectedRoute>
			) : (
				<LazyComponent />
			);
		}
		return null;
	};

	return (
		<BrowserRouter>
			<AuthProvider>
				<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
					<Suspense fallback={<div className="flex items-center justify-center min-h-screen">Загрузка...</div>}>
						<Routes>
							{/* Роуты с сайдбаром */}
							<Route element={<SidebarLayout />}>
								{sidebarRoutes.map((route) => (
									<Route 
										key={route.path} 
										path={route.path}
										element={createRouteElement(route)} 
									/>
								))}
							</Route>

							{/* Роуты без сайдбара */}
							<Route element={<SimpleLayout />}>
								{simpleRoutes.map((route) => (
									<Route 
										key={route.path} 
										path={route.path}
										element={createRouteElement(route)} 
									/>
								))}
							</Route>

							{/* Fallback */}
							<Route path="*" element={<Navigate to="/login" replace />} />
						</Routes>
					</Suspense>
				</ThemeProvider>
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;