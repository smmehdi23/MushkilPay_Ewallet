import { getAuthToken } from "./auth";

/** Empty string = same origin (Vite dev server proxies to FastAPI). Set in production via VITE_API_BASE_URL. */
export const API_BASE_URL = String(import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

function shouldAttachAuth(path: string) {
  return !/^\/(user\/(login|signup)|admin\/login)(\?|$)/.test(path);
}

async function apiFetch<T>(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token && shouldAttachAuth(path)) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (!headers.has("Content-Type") && options.body) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  let data: T | null = null;
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    data = (await response.json()) as T;
  }

  if (!response.ok) {
    const message =
      (data as { message?: string })?.message ||
      (data as { detail?: string })?.detail ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export async function loginUser(email: string, password: string) {
  return apiFetch<{ status: string; token?: string; user_id?: number; message?: string }>(
    "/user/login",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function loginAdmin(username: string, password: string) {
  return apiFetch<{ status: string; token?: string; role?: string; message?: string }>(
    "/admin/login",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
  );
}

export async function signupUser(payload: {
  full_name: string;
  email: string;
  password: string;
  phone: string;
  cnic: string;
  pin: string;
}) {
  return apiFetch<{ status: string; message?: string }>("/user/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function lookupAccount(accountNumber: string) {
  return apiFetch<{
    status: string;
    message?: string;
    data?: {
      wallet_id: number;
      user_id: number;
      full_name: string;
      email: string;
      phone: string;
    };
  }>(`/user/lookup?account_number=${encodeURIComponent(accountNumber)}`);
}

export async function transferMoney(payload: {
  receiver_account: string;
  amount: number;
  pin: string;
}) {
  return apiFetch<{ status: string; receipt?: Record<string, unknown>; message?: string }>(
    "/transfer",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}

export async function getProfile() {
  return apiFetch<{ status: string; data: Record<string, unknown> }>("/user/profile");
}

export async function updateProfile(payload: Record<string, unknown>) {
  return apiFetch<{ status: string; message?: string }>("/user/profile", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function changePassword(payload: { old_password: string; new_password: string }) {
  return apiFetch<{ status: string; message?: string }>("/user/change-password", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function deleteAccount() {
  return apiFetch<{ status: string; message?: string }>("/user/delete", {
    method: "DELETE",
  });
}

export async function getTransactions() {
  return apiFetch<{ status: string; data: Array<Record<string, unknown>> }>(
    "/user/transactions",
  );
}

export async function getNotifications() {
  return apiFetch<{ status: string; data: Array<Record<string, unknown>> }>(
    "/user/notifications",
  );
}

export async function markNotificationsRead(ids: Array<number | string>) {
  return apiFetch<{ status: string; message?: string }>("/user/notifications/read", {
    method: "POST",
    body: JSON.stringify({ ids }),
  });
}

export async function getCard() {
  return apiFetch<{ status: string; data?: Record<string, unknown> }>("/user/cards");
}
export async function getAllCards() {
  return apiFetch<{ status: string; data?: Array<Record<string, unknown>> }>("/user/cards/all");
}
export async function activateCard(payload: { card_number: string; cvv: string }) {
  return apiFetch<{ status: string; message?: string }>("/user/cards/activate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function requestNewCard(payload: {
  reason: string;
  delivery_address: string;
  request_type?: string;
}) {
  return apiFetch<{ status: string; message?: string }>("/user/cards/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function changeCardPin(payload: {
  card_last4: string;
  old_pin?: string;
  new_pin: string;
}) {
  return apiFetch<{ status: string; message?: string }>("/user/cards/change-pin", {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export async function getWithdrawalLimit() {
  return apiFetch<{ status: string; data?: { limit_amount?: number | null } }>(
    "/user/withdrawal-limit",
  );
}

export async function setWithdrawalLimit(limit_amount: number) {
  return apiFetch<{ status: string; message?: string }>("/user/withdrawal-limit", {
    method: "PUT",
    body: JSON.stringify({ limit_amount }),
  });
}

export async function adminTopup(payload: {
  account_number: string;
  amount: number;
  method: string;
  reference?: string;
}) {
  return apiFetch<{ status: string; message?: string }>("/admin/topup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function donateCharity(payload: {
  trust_name: string;
  amount: number;
  pin: string;
}) {
  return apiFetch<{ status: string; message?: string }>("/user/charity/donate", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function downloadStatementPdf(): Promise<Blob> {
  const token = getAuthToken();
  const headers = new Headers();
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }
  const response = await fetch(`${API_BASE_URL}/user/download-statement`, { headers });
  if (!response.ok) {
    throw new Error("Could not download statement.");
  }
  return response.blob();
}
