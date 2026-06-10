import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import LoginPage from "@/pages/login";
import { useSessionStore } from "@/stores/session";
import { Desktop } from "@/desktop";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useSessionStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Desktop shell — all apps open as windows inside the desktop
function DesktopPage() {
  return <Desktop />;
}

const router = createBrowserRouter([
  { path: "/", element: <Navigate to="/desktop" replace /> },
  { path: "/login", element: <LoginPage /> },
  {
    path: "/desktop",
    element: (
      <ProtectedRoute>
        <DesktopPage />
      </ProtectedRoute>
    ),
  },
  // Legacy routes redirect to desktop
  ...["/dashboard", "/storage", "/shares", "/files", "/docker", "/users", "/logs", "/alerts", "/system", "/settings"].map((path) => ({
    path,
    element: <Navigate to="/desktop" replace />,
  })),
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}