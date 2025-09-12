import { ReactNode, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { RoutingProcessor } from "./core/RoutingProcessor";

interface ProtectedRouteProps {
  children: ReactNode;
  redirectPath?: string;
}

const routingProcessor = new RoutingProcessor();

export function ProtectedRoute({
  children,
  redirectPath = "/auth-mf/login",
}: ProtectedRouteProps) {
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && !user) {
      routingProcessor.navigate(redirectPath);
    }
  }, [user, loading, redirectPath]);

  if (loading) {
    return <div>Загрузка...</div>;
  }

  if (!user) {
    return null;
  }

  return <>{children}</>;
}