export type AuthRole = "user" | "admin";

const TOKEN_KEY = "auth_token";
const ROLE_KEY = "auth_role";
const USER_ID_KEY = "auth_user_id";

export function saveAuth(token: string, role: AuthRole, userId?: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(ROLE_KEY, role);
  if (userId !== undefined) {
    localStorage.setItem(USER_ID_KEY, String(userId));
  }
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(USER_ID_KEY);
}

export function getAuthToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function getAuthRole(): AuthRole | null {
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "user" || role === "admin") {
    return role;
  }
  return null;
}

export function getAuthUserId() {
  const raw = localStorage.getItem(USER_ID_KEY);
  if (!raw) {
    return null;
  }
  const value = Number(raw);
  return Number.isNaN(value) ? null : value;
}
