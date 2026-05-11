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

const handleResponse = async (response) => {
  if (response.status === 204) {
    return null;
  }

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const detail =
      payload?.detail ||
      payload?.error ||
      payload?.message ||
      `Запрос завершился с ошибкой ${response.status}`;
    throw new Error(detail);
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
        method: "PUT",
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
};

export { API_BASE };

