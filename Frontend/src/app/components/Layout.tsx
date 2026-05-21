import { useEffect, useMemo, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { BrandMark } from "./BrandMark";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "./ui/sheet";
import { clearAuth, getAuthRole } from "../lib/auth";
import { getNotifications, markNotificationsRead } from "../lib/api";

const BellIcon = () => (
  <svg width="24" height="30" viewBox="0 0 32 40" fill="none">
    <path
      d="M0 34V30H4V16C4 13.2333 4.83333 10.7833 6.5 8.65C8.16667 6.48333 10.3333 5.06666 13 4.4V3C13 2.16667 13.2833 1.46667 13.85 0.899998C14.45 0.299999 15.1667 0 16 0C16.8333 0 17.5333 0.299999 18.1 0.899998C18.7 1.46667 19 2.16667 19 3V4.4C21.6667 5.06666 23.8333 6.48333 25.5 8.65C27.1667 10.7833 28 13.2333 28 16V30H32V34H0ZM16 40C14.9 40 13.95 39.6167 13.15 38.85C12.3833 38.05 12 37.1 12 36H20C20 37.1 19.6 38.05 18.8 38.85C18.0333 39.6167 17.1 40 16 40ZM8 30H24V16C24 13.8 23.2167 11.9167 21.65 10.35C20.0833 8.78333 18.2 8 16 8C13.8 8 11.9167 8.78333 10.35 10.35C8.78333 11.9167 8 13.8 8 16V30Z"
      fill="#BFBFBF"
    />
  </svg>
);

const PowerIcon = () => (
  <svg width="24" height="26" viewBox="0 0 40 44" fill="none">
    <path
      d="M32.73 11.28C35.2468 13.7976 36.9605 17.0049 37.6546 20.4964C38.3486 23.9879 37.9918 27.6068 36.6293 30.8955C35.2667 34.1842 32.9596 36.9951 29.9997 38.9727C27.0397 40.9503 23.5598 42.0058 20 42.0058C16.4402 42.0058 12.9603 40.9503 10.0004 38.9727C7.0404 36.9951 4.73329 34.1842 3.37074 30.8955C2.00819 27.6068 1.65139 23.9879 2.34544 20.4964C3.0395 17.0049 4.75325 13.7976 7.27001 11.28M20.01 2V22"
      stroke="#B3B3B3"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="4"
    />
  </svg>
);

import { UI } from "../lib/uiAssets";

const navItems = [
  { path: "/app", label: "Home", src: UI.navHome },
  { path: "/app/cards", label: "Cards", src: UI.navCards },
  { path: "/app/transactions", label: "Transactions", src: UI.navTx },
  { path: "/app/profile", label: "Profile", src: UI.navProfile },
  { path: "/app/settings", label: "Settings", src: UI.navSettings },
];

const adminNavItems = [
  { path: "/app", label: "Top-up", src: UI.navHome },
  { path: "/app/admin/cards", label: "Card Req.", src: UI.navCards },
  { path: "/app/admin/wallets", label: "Wallets", src: UI.navTx },
  { path: "/app/admin/settings", label: "Settings", src: UI.navSettings },
];

function mapNotificationsPayload(
  data: Array<Record<string, unknown>>,
): Array<{ id: number; title: string; message: string; created_at?: string; is_read?: boolean }> {
  return data.map((item) => ({
    id: Number(item.id),
    title: String(item.title || "Notification"),
    message: String(item.message || ""),
    created_at: item.created_at ? String(item.created_at) : undefined,
    is_read: Boolean(item.is_read),
  }));
}

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const role = getAuthRole();
  const bottomNavItems = useMemo(
    () => (role === "admin" ? adminNavItems : navItems),
    [role],
  );
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<
    Array<{ id: number; title: string; message: string; created_at?: string; is_read?: boolean }>
  >([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const handleLogout = () => {
    clearAuth();
    navigate("/");
  };

  const unreadCount = useMemo(
    () => notifications.filter((item) => !item.is_read).length,
    [notifications],
  );

  useEffect(() => {
    let cancelled = false;
    const refreshNotificationsList = async () => {
      try {
        const response = await getNotifications();
        if (cancelled) return;
        const data = Array.isArray(response.data) ? response.data : [];
        setNotifications(mapNotificationsPayload(data));
      } catch (error) {
        console.error(error);
      }
    };
    refreshNotificationsList();
    const onFocus = () => refreshNotificationsList();
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!notificationsOpen) {
      return;
    }
    const loadNotifications = async () => {
      try {
        setLoadingNotifications(true);
        const response = await getNotifications();
        const data = Array.isArray(response.data) ? response.data : [];
        const mapped = mapNotificationsPayload(data);
        setNotifications(mapped);

        const unreadIds = mapped.filter((item) => !item.is_read && !Number.isNaN(item.id)).map((item) => item.id);
        if (unreadIds.length) {
          await markNotificationsRead(unreadIds);
          setNotifications((prev) =>
            prev.map((item) => (unreadIds.includes(item.id) ? { ...item, is_read: true } : item)),
          );
        }
      } catch (error) {
        console.error(error);
      } finally {
        setLoadingNotifications(false);
      }
    };
    loadNotifications();
  }, [notificationsOpen]);

  return (
    <div className="min-h-screen w-full flex flex-col mp-bg" style={{ fontFamily: "'Montserrat', sans-serif" }}>
      {/* Top Header Bar */}
      <div className="relative w-full">
        <div
          className="absolute inset-0 rounded-b-[2.5rem] sm:rounded-b-[3.75rem]"
          style={{
            background: "var(--mp-surface-elevated)",
            boxShadow: "var(--mp-header-shadow)",
          }}
        />
        <div className="mp-shell relative z-10 flex min-h-[4.25rem] sm:min-h-[4.5rem] items-center justify-between py-3 sm:py-4">
          <div className="flex min-w-0 flex-1 items-center">
            <BrandMark variant="header" className="justify-start" />
          </div>

          <div className="flex shrink-0 items-center gap-4 sm:gap-5">
            <Sheet open={notificationsOpen} onOpenChange={setNotificationsOpen}>
              <SheetTrigger className="opacity-80 hover:opacity-100 transition-opacity relative">
                <BellIcon />
                {unreadCount > 0 && (
                  <span
                    className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full"
                    style={{ background: "#7c68c9" }}
                  />
                )}
              </SheetTrigger>
              <SheetContent
                side="right"
                className="border-none"
                style={{ background: "#232228", color: "#f2f0ff" }}
              >
                <SheetHeader className="pb-2">
                  <SheetTitle style={{ fontFamily: "'Montserrat', sans-serif", color: "#f2f0ff" }}>
                    Notifications
                  </SheetTitle>
                </SheetHeader>
                {loadingNotifications ? (
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      color: "#b8b4d4",
                      fontSize: "12px",
                    }}
                  >
                    Loading updates...
                  </p>
                ) : notifications.length === 0 ? (
                  <p
                    style={{
                      fontFamily: "'Montserrat', sans-serif",
                      color: "#b8b4d4",
                      fontSize: "12px",
                    }}
                  >
                    No notifications yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {notifications.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[16px] p-4"
                        style={{ background: "#2a2733" }}
                      >
                        <div
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 700,
                            fontSize: "13px",
                            color: "#f2f0ff",
                          }}
                        >
                          {item.title}
                        </div>
                        <div
                          style={{
                            fontFamily: "'Montserrat', sans-serif",
                            fontWeight: 500,
                            fontSize: "12px",
                            color: "#e8e4f0",
                            marginTop: "4px",
                          }}
                        >
                          {item.message}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SheetContent>
            </Sheet>
            <button
              onClick={handleLogout}
              className="opacity-80 hover:opacity-100 transition-opacity"
            >
              <PowerIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-auto pb-28">
        <div className="mp-shell py-6 sm:py-8">
          <Outlet />
        </div>
      </div>

      {/* Bottom Navigation — icon strip aligned to reference */}
      <div className="fixed bottom-4 left-1/2 z-50 w-[min(100%-1.5rem,28rem)] -translate-x-1/2 sm:bottom-6">
        <div
          className="flex items-center justify-between gap-1 rounded-[var(--mp-radius-pill)] px-3 py-2.5 sm:px-5 sm:py-3"
          style={{
            background: "var(--mp-surface-elevated)",
            boxShadow: "var(--mp-nav-shadow)",
          }}
        >
          {bottomNavItems.map(({ path, label, src }) => {
            const isActive =
              path === "/app"
                ? location.pathname === "/app" || location.pathname === "/app/"
                : location.pathname.startsWith(path);

            return (
              <button
                key={path}
                type="button"
                onClick={() => navigate(path)}
                title={label}
                className="flex flex-1 flex-col items-center justify-center rounded-2xl py-1 transition-transform active:scale-95"
              >
                <div
                  className={`flex h-11 w-11 sm:h-12 sm:w-12 items-center justify-center rounded-2xl transition-colors ${
                    isActive ? "bg-[var(--mp-surface)]" : "bg-transparent hover:bg-black/10"
                  }`}
                >
                  <img
                    src={src}
                    alt=""
                    className={`h-7 w-7 sm:h-8 sm:w-8 object-contain ${isActive ? "opacity-100" : "opacity-55"}`}
                    draggable={false}
                  />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}