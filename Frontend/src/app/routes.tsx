import { createBrowserRouter, Navigate } from "react-router";
import { LoginPage } from "./pages/LoginPage";
import { SKIP_LOGIN } from "./lib/devFlags";
import { HomePage } from "./pages/HomePage";
import { CardManagementPage } from "./pages/CardManagementPage";
import { TransactionsPage } from "./pages/TransactionsPage";
import { ProfilePage } from "./pages/ProfilePage";
import { SettingsPage } from "./pages/SettingsPage";
import { AdminCardManagementPage } from "./pages/AdminCardManagementPage";
import { AdminWalletsPage } from "./pages/AdminWalletsPage";
import { AdminTransactionsPage } from "./pages/AdminTransactionsPage";
import { AdminSettingsPage } from "./pages/AdminSettingsPage";
import { ProtectedLayout } from "./components/ProtectedLayout";
import { CustomerOnly } from "./components/CustomerOnly";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: SKIP_LOGIN ? () => <Navigate to="/app" replace /> : LoginPage,
  },
  {
    path: "/app",
    Component: ProtectedLayout,
    children: [
      { index: true, Component: HomePage },
      {
        path: "cards",
        element: (
          <CustomerOnly>
            <CardManagementPage />
          </CustomerOnly>
        ),
      },
      {
        path: "transactions",
        element: (
          <CustomerOnly>
            <TransactionsPage />
          </CustomerOnly>
        ),
      },
      {
        path: "profile",
        element: (
          <CustomerOnly>
            <ProfilePage />
          </CustomerOnly>
        ),
      },
      {
        path: "settings",
        element: (
          <CustomerOnly>
            <SettingsPage />
          </CustomerOnly>
        ),
      },
      {
        path: "admin/cards",
        element: <AdminCardManagementPage />,
      },
      {
        path: "admin/wallets",
        element: <AdminWalletsPage />,
      },
      {
        path: "admin/transactions",
        element: <AdminTransactionsPage />,
      },
      {
        path: "admin/settings",
        element: <AdminSettingsPage />,
      },
    ],
  },
]);
