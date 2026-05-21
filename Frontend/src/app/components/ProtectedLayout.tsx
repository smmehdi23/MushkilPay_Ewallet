import { Navigate } from "react-router";
import { Layout } from "./Layout";
import { getAuthToken } from "../lib/auth";
import { SKIP_LOGIN } from "../lib/devFlags";

export function ProtectedLayout() {
  if (!SKIP_LOGIN && !getAuthToken()) {
    return <Navigate to="/" replace />;
  }
  return <Layout />;
}
