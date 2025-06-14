import LoginPage from "./Login";
import Panel from "./Panel";
import { ProtectedRoute } from "./ProtectedRoute";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

import { ThemeProvider } from "./components/theme-provider";
import { AuthProvider } from "./AuthContext";

function App() {
	return (
		<BrowserRouter>
		<AuthProvider>
				<ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
					<Routes>
						<Route path="/login" element={<LoginPage />} />

						<Route
							path="/auth/callback/:provider"
							element={
								<div className="flex h-screen flex-col items-center justify-center p-4">
									<div className="mb-4 text-xl">
										Completing authentication...
									</div>
								</div>
							}
						/>

						<Route
							path="/dashboard"
							element={
								<ProtectedRoute>
									<Panel />
								</ProtectedRoute>
							}
						/>
						<Route path="*" element={<Navigate to="/login" replace />} />
					</Routes>
				</ThemeProvider>
			</AuthProvider>
		</BrowserRouter>
	);
}

export default App;
