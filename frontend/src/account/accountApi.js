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

export function onlyAppJobs(jobs, appSlug) {
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((job) => job?.appSlug === appSlug);
}

export async function listJobs({ limit = 20, appSlug } = {}) {
  const params = new URLSearchParams({ limit: String(limit) });
  if (appSlug) {
    params.set("app", appSlug);
  }
  return accountRequest(`/api/jobs?${params.toString()}`);
}

export async function createJob({ appSlug, jobType, inputSummary, publicLabel, idempotencyKey, turnstileToken }) {
  const csrfToken = await getCsrfToken();
  return accountRequest("/api/jobs", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-CSRF-Token": csrfToken,
      ...(turnstileToken ? { "X-Turnstile-Token": turnstileToken } : {}),
    },
    body: JSON.stringify({
      appSlug,
      jobType,
      inputSummary,
      publicLabel,
      idempotencyKey,
    }),
  });
}

export async function getJob(jobId) {
  return accountRequest(`/api/jobs/${encodeURIComponent(jobId)}`);
}

export async function cancelJob(jobId) {
  const csrfToken = await getCsrfToken();
  return accountRequest(`/api/jobs/${encodeURIComponent(jobId)}/cancel`, {
    method: "POST",
    headers: {
      "X-CSRF-Token": csrfToken,
    },
  });
}

export async function uploadJobArtifact(jobId, artifactName, payload, { kind = "input" } = {}) {
  const csrfToken = await getCsrfToken();
  return accountRequest(
    `/api/jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactName)}?kind=${encodeURIComponent(kind)}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-CSRF-Token": csrfToken,
      },
      body: JSON.stringify(payload),
    },
  );
}

export async function downloadJobArtifact(jobId, artifactName) {
  return accountRequest(
    `/api/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(artifactName)}`,
  );
}

export function jobArtifactDownloadUrl(jobId, artifactName) {
  return `${ACCOUNT_API_BASE}/api/jobs/${encodeURIComponent(jobId)}/download/${encodeURIComponent(artifactName)}`;
}

export function loginUrl(returnTo = "") {
  const url = new URL(`${ACCOUNT_API_BASE}/login`);
  const destination =
    returnTo || (typeof window !== "undefined" ? window.location.href : "");
  if (destination) {
    url.searchParams.set("return_to", destination);
  }
  return url.toString();
}
