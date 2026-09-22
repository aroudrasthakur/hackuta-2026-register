import { Navigate, useLocation } from "react-router-dom";
import { useApplicantRouting } from "../hooks/useApplicantRouting";

type ProtectedRouteProps = {
  children: React.ReactNode;
  requireAuth?: boolean;
  requireNoSubmittedRegistration?: boolean;
  requireSubmittedRegistration?: boolean;
  requireRegistration?: boolean;
};

export function ProtectedRoute({
  children,
  requireAuth = true,
  requireNoSubmittedRegistration = false,
  requireSubmittedRegistration = false,
  requireRegistration = false,
}: ProtectedRouteProps) {
  const location = useLocation();
  const routing = useApplicantRouting();

  if (routing.isLoading) {
    return (
      <main className="register-page flex min-h-screen items-center justify-center bg-(--clay)">
        <p className="text-sm text-(--ocean)" role="status" aria-live="polite">
          Loading…
        </p>
      </main>
    );
  }

  if (requireAuth && !routing.isAuthenticated) {
    return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  }

  if (requireNoSubmittedRegistration && routing.hasSubmittedRegistration) {
    return <Navigate to="/profile" replace />;
  }

  if (requireSubmittedRegistration && !routing.hasSubmittedRegistration) {
    return <Navigate to="/register" replace />;
  }

  if (requireRegistration && !routing.hasRegistration) {
    return <Navigate to="/register" replace />;
  }

  return children;
}
