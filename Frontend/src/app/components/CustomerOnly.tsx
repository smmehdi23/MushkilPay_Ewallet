import { Navigate } from "react-router";
import { getAuthRole } from "../lib/auth";

/** Admin JWT cannot use wallet-only pages; redirect to home (top-up panel). */
export function CustomerOnly({ children }: { children: React.ReactNode }) {
  if (getAuthRole() === "admin") {
    return <Navigate to="/app" replace />;
  }
  return <>{children}</>;
}
