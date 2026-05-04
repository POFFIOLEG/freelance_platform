import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { jobApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import JobCard from "../components/JobCard.jsx";
import styles from "./JobList.module.css";

const initialFilters = { q: "", category: "", location: "", status: "" };
const LOCATION_SUGGESTIONS = [
  "Москва",
  "Санкт-Петербург",
  "Казань",
  "Новосибирск",
  "Екатеринбург",
  "Удаленно",
];

const JobList = () => {
  const location = useLocation();
  const { user, token } = useAuth();
  const [filters, setFilters] = useState({ ...initialFilters });
  const [appliedFilters, setAppliedFilters] = useState({ ...initialFilters });
  const [jobs, setJobs] = useState([]);
  const [expandedJob, setExpandedJob] = useState(null);
  const [applicationDrafts, setApplicationDrafts] = useState({});
  const [bidDrafts, setBidDrafts] = useState({});
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);

  const fetchJobs = async () => {
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      const data = await jobApi.list(appliedFilters);
      setJobs(data);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [appliedFilters]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const next = {
      q: params.get("q") || "",
      category: params.get("category") || "",
      location: params.get("location") || "",
      status: params.get("status") || "",
    };
    setFilters(next);
    setAppliedFilters(next);
  }, [location.search]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const toggleApply = (jobId) => {
    setExpandedJob((current) => (current === jobId ? null : jobId));
    setApplicationDrafts((prev) => ({
      ...prev,
      [jobId]: prev[jobId] || { cover_letter: "", expected_budget: "" },
    }));
  };

  const updateDraft = (jobId, field, value) => {
    setApplicationDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || { cover_letter: "", expected_budget: "" }),
        [field]: value,
      },
    }));
  };

  const submitApplication = async (jobId) => {
    if (!token) {
      setStatus({ type: "error", message: "Авторизуйтесь, чтобы откликаться" });
      return;
    }
    const draft = applicationDrafts[jobId];
    if (!draft) return;
    try {
      await jobApi.apply(
        jobId,
        {
          cover_letter: draft.cover_letter,
          expected_budget: draft.expected_budget ? Number(draft.expected_budget) : 0,
        },
        token,
      );
      setStatus({ type: "success", message: "Отклик отправлен" });
      setExpandedJob(null);
      setApplicationDrafts((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitBid = async (jobId) => {
    if (!token) {
      setStatus({ type: "error", message: "Авторизуйтесь, чтобы сделать ставку" });
      return;
    }
    const draft = bidDrafts[jobId];
    if (!draft?.amount) {
      setStatus({ type: "error", message: "Укажите сумму ставки" });
      return;
    }
    try {
      await jobApi.placeBid(
        jobId,
        {
          amount: Number(draft.amount),
          message: draft.message || "",
        },
        token,
      );
      setStatus({ type: "success", message: "Ставка отправлена" });
      setBidDrafts((prev) => ({
        ...prev,
        [jobId]: { amount: "", message: "" },
      }));
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <div className={`page job-page ${styles.root}`}>
      <div className="card">
        <h2>Поиск заданий</h2>
        <form className="filters" onSubmit={handleFilterSubmit}>
          <input
            placeholder="Ключевые слова"
            value={filters.q}
            onChange={(event) => updateFilter("q", event.target.value)}
          />
          <input
            placeholder="Категория"
            value={filters.category}
            onChange={(event) => updateFilter("category", event.target.value)}
          />
          <input
            placeholder="Локация"
            value={filters.location}
            onChange={(event) => updateFilter("location", event.target.value)}
            list="joblist-location-suggestions"
          />
          <datalist id="joblist-location-suggestions">
            {LOCATION_SUGGESTIONS.map((item) => (
              <option key={item} value={item} />
            ))}
          </datalist>
          <select value={filters.status} onChange={(event) => updateFilter("status", event.target.value)}>
            <option value="">Все статусы</option>
            <option value="open">Открыто</option>
            <option value="in_progress">В работе</option>
            <option value="submitted">На проверке</option>
            <option value="completed">Завершено</option>
          </select>
          <button className="primary-button" type="submit" disabled={loading}>
            Найти
          </button>
        </form>
        {status.message && (
          <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
        )}
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Найдено заданий: {jobs.length}</h3>
          <button className="secondary-button" onClick={fetchJobs}>
            Обновить
          </button>
        </div>
        {loading && <p>Загружаем...</p>}
        {!loading && jobs.length === 0 && <p className="muted-text">Заданий не найдено.</p>}
        <div className="job-grid">
          {jobs.map((job) => (
            <JobCard key={job.id} job={job}>
              {job.is_exchange && user?.role === "worker" && (
                <div className="apply-section">
                  <h4>Торги по заданию</h4>
                  <form
                    className="apply-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      submitBid(job.id);
                    }}
                  >
                    <input
                      type="number"
                      placeholder="Сумма ставки"
                      min={0}
                      value={bidDrafts[job.id]?.amount || ""}
                      onChange={(event) =>
                        setBidDrafts((prev) => ({
                          ...prev,
                          [job.id]: { ...(prev[job.id] || {}), amount: event.target.value },
                        }))
                      }
                    />
                    <input
                      placeholder="Комментарий к ставке"
                      value={bidDrafts[job.id]?.message || ""}
                      onChange={(event) =>
                        setBidDrafts((prev) => ({
                          ...prev,
                          [job.id]: { ...(prev[job.id] || {}), message: event.target.value },
                        }))
                      }
                    />
                    <button className="primary-button">Сделать ставку</button>
                  </form>
                </div>
              )}
              {user?.role === "worker" && job.status === "open" && job.employer.id !== user.id && (
                <div className="apply-section">
                  <button className="secondary-button" type="button" onClick={() => toggleApply(job.id)}>
                    {expandedJob === job.id ? "Скрыть форму" : "Откликнуться"}
                  </button>
                  {expandedJob === job.id && (
                    <form
                      className="apply-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitApplication(job.id);
                      }}
                    >
                      <textarea
                        rows={3}
                        placeholder="Кратко опишите опыт и подход"
                        value={applicationDrafts[job.id]?.cover_letter || ""}
                        onChange={(event) => updateDraft(job.id, "cover_letter", event.target.value)}
                        required
                      />
                      <input
                        type="number"
                        placeholder="Бюджет"
                        value={applicationDrafts[job.id]?.expected_budget || ""}
                        onChange={(event) => updateDraft(job.id, "expected_budget", event.target.value)}
                      />
                      <button className="primary-button">Отправить</button>
                    </form>
                  )}
                </div>
              )}
            </JobCard>
          ))}
        </div>
      </section>
    </div>
  );
};

export default JobList;
