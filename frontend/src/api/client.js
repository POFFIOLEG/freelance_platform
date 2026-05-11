const trimTrailingSlash = (value = "") =>
  value.endsWith("/") ? value.slice(0, -1) : value;

const API_BASE = trimTrailingSlash(import.meta.env.VITE_API_URL || "http://localhost:8000");

const jsonHeaders = { "Content-Type": "application/json" };

const buildHeaders = (token, extra = {}) => {
  const headers = { ...jsonHeaders, ...extra };
  if (token) {
    headers.Authorization = `Token ${token}`;
  }
  return headers;
};

const formatErrorBody = (payload, status) => {
  if (payload == null || typeof payload !== "object") {
    return `Запрос завершился с ошибкой ${status}`;
  }
  if (payload.detail != null) {
    const d = payload.detail;
    if (Array.isArray(d)) {
      return d
        .map((item) => (typeof item === "string" ? item : item?.string || JSON.stringify(item)))
        .join(" ");
    }
    return String(d);
  }
  if (payload.message) return String(payload.message);
  if (payload.error) return String(payload.error);
  const fieldLines = Object.entries(payload).map(([key, val]) => {
    if (Array.isArray(val)) return `${key}: ${val.join(" ")}`;
    if (val && typeof val === "object") return `${key}: ${JSON.stringify(val)}`;
    return `${key}: ${val}`;
  });
  if (fieldLines.length) return fieldLines.join("\n");
  return `Запрос завершился с ошибкой ${status}`;
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
    throw new Error(formatErrorBody(payload, response.status));
  }

  return payload;
};

const apiFetch = async (path, { method = "GET", token, body, headers, ...rest } = {}) => {
  const url = `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const options = {
    method,
    headers: buildHeaders(token, headers),
    ...rest,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
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
  async dashboard(token) {
    return apiFetch("/api/jobs/dashboard/", { method: "GET", token });
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
};

export const chatApi = {
  async list(jobId, token) {
    return apiFetch(`/api/chat/${jobId}/`, { method: "GET", token });
  },
  async send(jobId, payload, token) {
    return apiFetch(`/api/chat/${jobId}/`, {
      method: "POST",
      body: payload,
      token,
    });
  },
};

export const reviewApi = {
  async list(filters = {}, token) {
    const query = serializeQuery(filters);
    return apiFetch(`/api/reviews/${query}`, { method: "GET", token });
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

