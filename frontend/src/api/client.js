/**
 * HTTP-клиент к Django REST API: authApi, jobApi, chatApi, hubApi, reviewApi.
 * Токен передаётся заголовком Authorization; FormData — для загрузки файлов без JSON.
 */
const trimTrailingSlash = (value = "") =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_URL || "http://localhost:8000");

const jsonHeaders = { "Content-Type": "application/json" };

const buildHeaders = (token, extra = {}, { json = true } = {}) => {
  const headers = { ...extra };
  if (json) {
    Object.assign(headers, jsonHeaders);
  }
  if (token) {
    headers.Authorization = `Token ${token}`;
  }
  return headers;
};

/** Ошибка API: message — как раньше; fields — плоский объект поле → текст (валидация DRF). */
export class ApiError extends Error {
  constructor(message, { status, fields } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.fields = fields;
  }
}

const sanitizeServerMessage = (text) => {
  if (text == null) return "";
  const s = String(text).trim();
  if (!s) return "";
  const probe = s.slice(0, 200).toLowerCase();
  if (
    probe.startsWith("<!doctype") ||
    probe.startsWith("<html") ||
    probe.includes("<title>") ||
    probe.includes("typeerror at /")
  ) {
    return "Ошибка на сервере. Откройте логи backend; на продакшене отключите DEBUG, чтобы приходил JSON, а не HTML.";
  }
  if (s.length > 1200) return `${s.slice(0, 1200)}…`;
  return s;
};

const formatErrorBody = (payload, status) => {
  if (payload == null || typeof payload !== "object") {
    return sanitizeServerMessage(`Запрос завершился с ошибкой ${status}`);
  }
  const finalize = (msg) => {
    const s = sanitizeServerMessage(msg);
    if (typeof payload.debug === "string" && payload.debug.trim()) {
      return `${s}\n${payload.debug.trim()}`;
    }
    return s;
  };
  if (payload.detail != null) {
    const d = payload.detail;
    if (Array.isArray(d)) {
      return finalize(
        d
          .map((item) => (typeof item === "string" ? item : item?.string || JSON.stringify(item)))
          .join(" "),
      );
    }
    return finalize(String(d));
  }
  if (payload.message) return finalize(String(payload.message));
  if (payload.error) return finalize(String(payload.error));
  const fieldLines = Object.entries(payload)
    .filter(([key]) => key !== "debug")
    .map(([key, val]) => {
      if (Array.isArray(val)) return `${key}: ${sanitizeServerMessage(val.join(" "))}`;
      if (val && typeof val === "object") return `${key}: ${sanitizeServerMessage(JSON.stringify(val))}`;
      return `${key}: ${sanitizeServerMessage(val)}`;
    });
  if (fieldLines.length) return finalize(fieldLines.join("\n"));
  return finalize(`Запрос завершился с ошибкой ${status}`);
};

const fieldErrorsFromPayload = (payload) => {
  if (payload == null || typeof payload !== "object") return null;
  const skip = new Set(["detail", "message", "error", "debug"]);
  const out = {};
  for (const [key, val] of Object.entries(payload)) {
    if (skip.has(key)) continue;
    if (Array.isArray(val)) {
      const line = sanitizeServerMessage(val.map((x) => (typeof x === "string" ? x : JSON.stringify(x))).join(" "));
      if (line) out[key] = line;
    } else if (val != null && typeof val === "object") {
      out[key] = sanitizeServerMessage(
        Object.entries(val)
          .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : String(v)}`)
          .join("; "),
      );
    } else if (val != null && val !== "") {
      out[key] = sanitizeServerMessage(String(val));
    }
  }
  return Object.keys(out).length ? out : null;
};

const handleResponse = async (response) => {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("content-type") || "";
  let payload = null;
  try {
    if (contentType.includes("application/json")) {
      payload = await response.json();
    } else {
      const text = await response.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text ? { detail: text.slice(0, 500) } : null;
      }
    }
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = formatErrorBody(payload, response.status);
    const fields = fieldErrorsFromPayload(payload);
    throw new ApiError(message, { status: response.status, fields: fields || undefined });
  }

  return payload;
};

const apiFetch = async (path, { method = "GET", token, body, headers, ...rest } = {}) => {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const withBody = body !== undefined && method !== "GET" && method !== "HEAD";
  const options = {
    method,
    headers: buildHeaders(token, headers, { json: withBody && !isFormData }),
    ...rest,
  };

  if (body !== undefined) {
    options.body = isFormData ? body : JSON.stringify(body);
  }

  const response = await fetch(url, options);
  return handleResponse(response);
};

const serializeQuery = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "boolean" && value === false) {
      return;
    }
    if (Array.isArray(value)) {
      if (value.length > 0) {
        search.append(key, value.join(","));
      }
      return;
    }
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, typeof value === "boolean" ? "1" : value);
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
};

export const authApi = {
  async register(payload) {
    return apiFetch("/api/auth/register/", { method: "POST", body: payload });
  },
  async login(payload) {
    return apiFetch("/api/auth/login/", { method: "POST", body: payload });
  },
  async me(token) {
    return apiFetch("/api/auth/me/", { method: "GET", token });
  },
  profile: {
    async get(token) {
      return apiFetch("/api/auth/profile/", { method: "GET", token });
    },
    async update(payload, token) {
      return apiFetch("/api/auth/profile/", {
        method: "PATCH",
        body: payload,
        token,
      });
    },
  },
  async switchRole(role, token) {
    return apiFetch("/api/auth/switch-role/", {
      method: "POST",
      body: { role },
      token,
    });
  },
  async deleteAccount(token) {
    return apiFetch("/api/auth/delete-account/", { method: "DELETE", token });
  },
  async portfolioList(token) {
    return apiFetch("/api/auth/portfolio/items/", { method: "GET", token });
  },
  async portfolioCreate(formData, token) {
    return apiFetch("/api/auth/portfolio/items/", { method: "POST", body: formData, token });
  },
  async portfolioUpdate(id, formData, token) {
    return apiFetch(`/api/auth/portfolio/items/${id}/`, { method: "PATCH", body: formData, token });
  },
  async portfolioDelete(id, token) {
    return apiFetch(`/api/auth/portfolio/items/${id}/`, { method: "DELETE", token });
  },
  async uploadAvatar(formData, token) {
    return apiFetch("/api/auth/profile/avatar/", { method: "POST", body: formData, token });
  },
  async uploadCardCover(formData, token) {
    return apiFetch("/api/auth/profile/card-cover/", { method: "POST", body: formData, token });
  },
  async publicPortfolio(userId) {
    return apiFetch(`/api/auth/users/${userId}/portfolio/`, { method: "GET" });
  },
  async kycDocumentsList(token) {
    return apiFetch("/api/auth/kyc/documents/", { method: "GET", token });
  },
  async kycDocumentUpload(formData, token) {
    return apiFetch("/api/auth/kyc/documents/", { method: "POST", body: formData, token });
  },
  async kycDocumentDelete(id, token) {
    return apiFetch(`/api/auth/kyc/documents/${id}/`, { method: "DELETE", token });
  },
};

export const jobApi = {
  async list(filters = {}, token) {
    const query = serializeQuery(filters);
    return apiFetch(`/api/jobs/${query}`, { method: "GET", token });
  },
  async get(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/`, { method: "GET", token });
  },
  async create(payload, token) {
    return apiFetch("/api/jobs/", { method: "POST", body: payload, token });
  },
  async apply(jobId, payload, token) {
    return apiFetch(`/api/jobs/${jobId}/apply/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
  async applications(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/applications/`, { method: "GET", token });
  },
  async assign(jobId, applicationId, token) {
    return apiFetch(`/api/jobs/${jobId}/assign/`, {
      method: "POST",
      body: { application_id: applicationId },
      token,
    });
  },
  async closeApplication(jobId, applicationId, token) {
    return apiFetch(`/api/jobs/${jobId}/close_application/`, {
      method: "POST",
      body: { application_id: applicationId },
      token,
    });
  },
  async submissions(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/submissions/`, {
      method: "GET",
      token,
    });
  },
  async submitResult(jobId, payload, token) {
    return apiFetch(`/api/jobs/${jobId}/submit_result/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
  async setStatus(jobId, payload, token) {
    return apiFetch(`/api/jobs/${jobId}/set_status/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
  async approveSubmission(jobId, submissionId, token) {
    return apiFetch(`/api/jobs/${jobId}/approve_submission/`, {
      method: "POST",
      body: { submission_id: submissionId },
      token,
    });
  },
  async rejectSubmission(jobId, submissionId, body, token) {
    return apiFetch(`/api/jobs/${jobId}/reject_submission/`, {
      method: "POST",
      body: { submission_id: submissionId, ...body },
      token,
    });
  },
  async releaseAssignee(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/release_assignee/`, {
      method: "POST",
      body: {},
      token,
    });
  },
  async dashboard(token) {
    return apiFetch("/api/jobs/dashboard/", { method: "GET", token });
  },
  async myApplications(token) {
    return apiFetch("/api/jobs/my-applications/", { method: "GET", token });
  },
  async bids(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/bid/`, { method: "GET", token });
  },
  async placeBid(jobId, payload, token) {
    return apiFetch(`/api/jobs/${jobId}/bid/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
  async pickContestWinner(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/pick_contest_winner/`, {
      method: "POST",
      token,
    });
  },
  async milestones(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/milestones/`, { method: "GET", token });
  },
  async createMilestone(jobId, payload, token) {
    return apiFetch(`/api/jobs/${jobId}/milestones/`, { method: "POST", body: payload, token });
  },
  async completeMilestone(jobId, milestoneId, token) {
    return apiFetch(`/api/jobs/${jobId}/complete_milestone/`, {
      method: "POST",
      body: { milestone_id: milestoneId },
      token,
    });
  },
  async specHistory(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/spec_history/`, { method: "GET", token });
  },
  async disputes(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/disputes/`, { method: "GET", token });
  },
  async openDispute(jobId, summary, token) {
    return apiFetch(`/api/jobs/${jobId}/open_dispute/`, {
      method: "POST",
      body: { summary },
      token,
    });
  },
  async resolveDispute(jobId, resolution, token) {
    return apiFetch(`/api/jobs/${jobId}/resolve_dispute/`, {
      method: "POST",
      body: { resolution },
      token,
    });
  },
  async escalateDispute(jobId, token) {
    return apiFetch(`/api/jobs/${jobId}/escalate_dispute/`, { method: "POST", body: {}, token });
  },
  async arbitrateDispute(jobId, decision, token) {
    return apiFetch(`/api/jobs/${jobId}/arbitrate_dispute/`, {
      method: "POST",
      body: { decision },
      token,
    });
  },
};

export const chatApi = {
  async list(jobId, token, { paginate, limit, offset } = {}) {
    const q = serializeQuery({
      paginate: paginate ? "1" : undefined,
      limit,
      offset,
    });
    return apiFetch(`/api/chat/${jobId}/${q}`, { method: "GET", token });
  },
  /** payload — JSON или FormData (текст + вложение) */
  async send(jobId, payload, token) {
    return apiFetch(`/api/chat/${jobId}/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
};

export const hubApi = {
  async featured() {
    return apiFetch("/api/hub/featured/", { method: "GET" });
  },
  async purchaseFeatured(slotIndex, token) {
    return apiFetch("/api/hub/featured/purchase/", {
      method: "POST",
      body: { slot_index: slotIndex },
      token,
    });
  },
  async calendar(token) {
    return apiFetch("/api/hub/calendar/", { method: "GET", token });
  },
  async recommendedWorkers() {
    return apiFetch("/api/hub/recommended-workers/", { method: "GET" });
  },
  async savedSearchesList(token) {
    return apiFetch("/api/hub/saved-searches/", { method: "GET", token });
  },
  async savedSearchCreate(body, token) {
    return apiFetch("/api/hub/saved-searches/", { method: "POST", body, token });
  },
  async savedSearchDelete(id, token) {
    return apiFetch(`/api/hub/saved-searches/${id}/`, { method: "DELETE", token });
  },
  async favoritesList(token) {
    return apiFetch("/api/hub/favorites/", { method: "GET", token });
  },
  async favoriteAdd(jobId, token) {
    return apiFetch("/api/hub/favorites/", { method: "POST", body: { job_id: jobId }, token });
  },
  async favoriteDelete(id, token) {
    return apiFetch(`/api/hub/favorites/${id}/`, { method: "DELETE", token });
  },
  async templatesList(token) {
    return apiFetch("/api/hub/templates/", { method: "GET", token });
  },
  async templateCreate(body, token) {
    return apiFetch("/api/hub/templates/", { method: "POST", body, token });
  },
  async reminderCreate(body, token) {
    return apiFetch("/api/hub/reminders/", { method: "POST", body, token });
  },
  async moderationJobs(token) {
    return apiFetch("/api/hub/moderation/jobs/", { method: "GET", token });
  },
  async moderationJobDecision(jobId, body, token) {
    return apiFetch(`/api/hub/moderation/jobs/${jobId}/decision/`, { method: "POST", body, token });
  },
  async moderationKycQueue(token) {
    return apiFetch("/api/hub/moderation/kyc/", { method: "GET", token });
  },
  async moderationKycDocs(profileId, token) {
    return apiFetch(`/api/hub/moderation/kyc/${profileId}/documents/`, { method: "GET", token });
  },
  async moderationKycDecision(profileId, body, token) {
    return apiFetch(`/api/hub/moderation/kyc/${profileId}/decision/`, { method: "POST", body, token });
  },
  async pushDeviceRegister(body, token) {
    return apiFetch("/api/hub/push-devices/", { method: "POST", body, token });
  },
  /** Скачать ICS с авторизацией (blob). */
  async downloadCalendarIcs(token) {
    const url = `${API_BASE}/api/hub/calendar/export.ics`;
    const headers = {};
    if (token) headers.Authorization = `Token ${token}`;
    const res = await fetch(url, { headers });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(text.slice(0, 400) || `Ошибка ${res.status}`);
    }
    return new Blob([text], { type: "text/calendar;charset=utf-8" });
  },
  /** Скачать календарь в Excel (.xlsx). */
  async downloadCalendarXlsx(token) {
    const url = `${API_BASE}/api/hub/calendar/export.xlsx`;
    const headers = {};
    if (token) headers.Authorization = `Token ${token}`;
    const res = await fetch(url, { headers });
    const buf = await res.arrayBuffer();
    if (!res.ok) {
      const text = new TextDecoder().decode(buf.slice(0, 400));
      throw new Error(text || `Ошибка ${res.status}`);
    }
    return new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
  },
};

export const reviewApi = {
  async list(filters = {}, token) {
    const query = serializeQuery(filters);
    return apiFetch(`/api/reviews/${query}`, { method: "GET", token });
  },
  async leaderboard(token, { limit = 12 } = {}) {
    const query = serializeQuery({ limit });
    return apiFetch(`/api/reviews/leaderboard/${query}`, { method: "GET", token });
  },
  async create(payload, token) {
    return apiFetch("/api/reviews/", { method: "POST", body: payload, token });
  },
  async summary(userId, token) {
    const query = serializeQuery({ user: userId });
    return apiFetch(`/api/reviews/summary/${query}`, { method: "GET", token });
  },
};

export { API_BASE };

