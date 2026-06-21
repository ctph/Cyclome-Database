const DEFAULT_ACCOUNT_API_BASE =
  typeof window !== "undefined" && window.location.hostname.endsWith("structf.studio")
    ? "https://account.structf.studio"
    : "http://127.0.0.1:8787";

export const ACCOUNT_API_BASE =
  (process.env.REACT_APP_STRUCTF_ACCOUNT_API_URL || DEFAULT_ACCOUNT_API_BASE).replace(/\/+$/g, "");

async function readJson(response) {
  return response.json().catch(() => null);
}

export async function accountRequest(path, options = {}) {
  const response = await fetch(`${ACCOUNT_API_BASE}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      ...(options.headers || {}),
    },
  });
  const body = await readJson(response);

  if (!response.ok) {
    const message = body?.error?.message || `Account request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.code = body?.error?.code || "account_request_failed";
    throw error;
  }

  return body;
}

export async function getCsrfToken() {
  const body = await accountRequest("/api/csrf");
  return body.csrfToken;
}

export async function getSession() {
  return accountRequest("/api/session");
}

export async function createGuestSession() {
  const csrfToken = await getCsrfToken();
  return accountRequest("/api/guest/session", {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

export async function logoutSession() {
  const csrfToken = await getCsrfToken();
  return accountRequest("/api/auth/logout", {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

export async function listJobs({ limit = 20 } = {}) {
  return accountRequest(`/api/jobs?limit=${encodeURIComponent(String(limit))}`);
}

export function loginUrl() {
  return `${ACCOUNT_API_BASE}/login`;
}
