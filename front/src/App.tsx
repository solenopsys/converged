import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Suspense, lazy, useState, useEffect } from "react";
import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./AuthContext";
import { ProtectedRoute } from "./ProtectedRoute";
import { staticRoutes } from "./routes.config";
import { SidebarLayout } from "./layouts/SidebarLayout";
import { SimpleLayout } from "./layouts/SimpleLayout";

function App() {
	const [dynamicRoutes, setDynamicRoutes] = useState([]);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState(null);

	useEffect(() => {
		const loadDynamicRoutes = async () => {
			try {
				const response = await fetch("/modules.json");
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				const data = await response.json();
				setDynamicRoutes(data);
			} catch (err) {
				console.error("Ошибка загрузки динамических роутов:", err);
				setError(err.message);
				setDynamicRoutes([]); // Устанавливаем пустой массив в случае ошибки
			} finally {
				setIsLoading(false);
			}
		};

		loadDynamicRoutes();
	}, []);

	const sidebarRoutes = dynamicRoutes.map(item => ({
		...item,
		component: () => import(item.link),
		protected: true,
	}));

	const simpleRoutes = staticRoutes;

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

	// Показываем загрузку пока получаем динамические роуты
	if (isLoading) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				Загрузка конфигурации...
			</div>
		);
	}

	// Показываем ошибку если что-то пошло не так
	if (error) {
		return (
			<div className="flex items-center justify-center min-h-screen">
				<div className="text-center">
					<p className="text-red-500 mb-2">Ошибка загрузки: {error}</p>
					<button 
						onClick={() => window.location.reload()} 
						className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
					>
						Попробовать снова
					</button>
				</div>
			</div>
		);
	}

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