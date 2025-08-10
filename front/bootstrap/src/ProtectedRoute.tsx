import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectPath?: string;
}

export function ProtectedRoute({ 
  children, 
  redirectPath = "/login" 
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  if (loading) {
    // You can replace this with a loading spinner component
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}