import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRole, AppRole } from "@/hooks/useUserRole";
import { PageLoader } from "./PageLoader";

interface RoleProtectedRouteProps {
  children: ReactNode;
  allowedRoles: AppRole[];
  redirectTo?: string;
}

const RoleProtectedRoute = ({
  children,
  allowedRoles,
  redirectTo = "/dashboard",
}: RoleProtectedRouteProps) => {
  const { isAuthenticated, isLoading } = useAuth();
  const { canAccess, isCheckinOperator } = useUserRole();
  const location = useLocation();

  // Show full-screen loader while auth is resolving
  if (isLoading) {
    return <PageLoader />;
  }

  // Not authenticated → redirect to login, preserving destination
  if (!isAuthenticated) {
    return (
      <Navigate
        to="/login"
        state={{ from: location.pathname }}
        replace
      />
    );
  }

  // Authenticated but lacks required role
  if (!canAccess(allowedRoles)) {
    const fallbackPath = isCheckinOperator ? "/events" : redirectTo;
    return <Navigate to={fallbackPath} replace />;
  }

  return <>{children}</>;
};

export default RoleProtectedRoute;
