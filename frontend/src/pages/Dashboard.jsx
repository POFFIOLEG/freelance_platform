import { useEffect, useMemo, useState } from "react";
import styles from "./Dashboard.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { jobApi } from "../api/client.js";
import JobCard from "../components/JobCard.jsx";

const statusOptions = [
  { value: "draft", label: "Черновик" },
  { value: "open", label: "Открыто" },
  { value: "in_progress", label: "В работе" },
  { value: "submitted", label: "Ожидает проверки" },
  { value: "completed", label: "Завершено" },
  { value: "cancelled", label: "Отменено" },
];

const Dashboard = () => {
  const { user, token } = useAuth();
  const [data, setData] = useState({ owned: [], assigned: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applications, setApplications] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [submissionDrafts, setSubmissionDrafts] = useState({});

  const isEmployer = user?.role === "employer";
  const isWorker = user?.role === "worker";

  const refresh = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const response = await jobApi.dashboard(token);
      setData(response);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      refresh();
    }
  }, [token]);

  const loadApplications = async (jobId) => {
    if (!token) return;
    if (applications[jobId]) return;
    try {
      const list = await jobApi.applications(jobId, token);
      setApplications((prev) => ({ ...prev, [jobId]: list }));
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSubmissions = async (jobId) => {
    if (!token) return;
    try {
      const list = await jobApi.submissions(jobId, token);
      setSubmissions((prev) => ({ ...prev, [jobId]: list }));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAssign = async (jobId, applicationId) => {
    if (!token) return;
    try {
      await jobApi.assign(jobId, applicationId, token);
      setSuccess("Исполнитель назначен");
      setApplications((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (jobId, status, note) => {
    if (!token) return;
    try {
      await jobApi.setStatus(
        jobId,
        {
          status,
          note,
        },
        token,
      );
      setSuccess("Статус обновлен");
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const updateSubmissionDraft = (jobId, field, value) => {
    setSubmissionDrafts((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || { message: "", deliverable_url: "" }),
        [field]: value,
      },
    }));
  };

  const submitResult = async (jobId) => {
    if (!token) return;
    const draft = submissionDrafts[jobId];
    if (!draft?.message) {
      setError("Добавьте комментарий к результату");
      return;
    }
    try {
      await jobApi.submitResult(
        jobId,
        {
          message: draft.message,
          deliverable_url: draft.deliverable_url,
        },
        token,
      );
      setSuccess("Результат отправлен");
      setSubmissionDrafts((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const ownedJobs = useMemo(() => data.owned || [], [data]);
  const assignedJobs = useMemo(() => data.assigned || [], [data]);

  if (!user) {
    return (
      <div className="page">
        <div className="card">
          <h2>Личный кабинет</h2>
          <p>Авторизуйтесь, чтобы управлять заданиями.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${styles.root} ${styles.dashboard}`}>
      <div className="card">
        <div className="card-header">
          <div>
            <h2>Кабинет</h2>
            <p className="muted-text">
              {isEmployer
                ? "Создавайте задания, назначайте исполнителей, получайте результаты."
                : "Следите за назначенными задачами, отправляйте результаты и получайте отзывы."}
            </p>
          </div>
          <button className="secondary-button" onClick={refresh} disabled={loading}>
            Обновить
          </button>
        </div>
        <div className="stats-row">
          <div className="stat-card">
            <p className="muted-text">Опубликовано</p>
            <strong>{ownedJobs.length}</strong>
          </div>
          <div className="stat-card">
            <p className="muted-text">Назначено мне</p>
            <strong>{assignedJobs.length}</strong>
          </div>
        </div>
        {loading && <p>Загружаем задания...</p>}
        {error && <p className="error-text">{error}</p>}
        {success && <p className="success-text">{success}</p>}
      </div>

      {isEmployer && (
        <section className="card">
          <h3>Мои задания</h3>
          {ownedJobs.length === 0 && <p className="muted-text">Вы еще не создали задания.</p>}
          <div className="job-grid">
            {ownedJobs.map((job) => (
              <JobCard key={job.id} job={job}>
                <div className={styles.jobActions}>
                  <label className="input-group">
                    <span>Статус</span>
                    <select
                      value={job.status}
                      onChange={(event) => handleStatusChange(job.id, event.target.value)}
                    >
                      {statusOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    className="secondary-button"
                    onClick={() => loadApplications(job.id)}
                    type="button"
                  >
                    Отклики ({job.applications_count})
                  </button>
                  <button
                    className="secondary-button"
                    onClick={() => loadSubmissions(job.id)}
                    type="button"
                  >
                    Результаты ({job.submissions_count || 0})
                  </button>
                </div>
                {applications[job.id] && (
                  <div className={styles.applicationsList}>
                    <p className="muted-text">Назначьте исполнителя:</p>
                    {applications[job.id].length === 0 && (
                      <p className="muted-text">Откликов пока нет.</p>
                    )}
                    {applications[job.id].map((application) => (
                      <div key={application.id} className={styles.applicationCard}>
                        <div>
                          <strong>{application.worker.username}</strong>
                          <p className="muted-text">{application.cover_letter || "Без комментария"}</p>
                          <p className="muted-text">
                            Бюджет: {Number(application.expected_budget).toLocaleString("ru-RU", { style: "currency", currency: "RUB" })}
                          </p>
                        </div>
                        <button
                          className="primary-button"
                          onClick={() => handleAssign(job.id, application.id)}
                          type="button"
                        >
                          Назначить
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {submissions[job.id] && (
                  <div className={styles.submissionsList}>
                    <p className="muted-text">Полученные результаты:</p>
                    {submissions[job.id].length === 0 && (
                      <p className="muted-text">Результатов пока нет.</p>
                    )}
                    {submissions[job.id].map((item) => (
                      <article key={item.id} className={styles.submissionCard}>
                        <header>
                          <strong>{item.worker.username}</strong>
                          <span className="muted-text">
                            {new Date(item.created_at).toLocaleString("ru-RU")}
                          </span>
                        </header>
                        <p>{item.message}</p>
                        {item.deliverable_url && (
                          <a
                            href={item.deliverable_url}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.link}
                          >
                            Перейти к результату
                          </a>
                        )}
                      </article>
                    ))}
                  </div>
                )}
              </JobCard>
            ))}
          </div>
        </section>
      )}

      {isWorker && (
        <section className="card">
          <h3>Назначенные задания</h3>
          {assignedJobs.length === 0 && <p className="muted-text">Вам еще не назначены задания.</p>}
          <div className="job-grid">
            {assignedJobs.map((job) => (
              <JobCard key={job.id} job={job}>
                <div className={styles.submissionForm}>
                  <textarea
                    placeholder="Комментарий к результату"
                    value={submissionDrafts[job.id]?.message || ""}
                    onChange={(event) => updateSubmissionDraft(job.id, "message", event.target.value)}
                  />
                  <input
                    placeholder="Ссылка на результат (опционально)"
                    value={submissionDrafts[job.id]?.deliverable_url || ""}
                    onChange={(event) =>
                      updateSubmissionDraft(job.id, "deliverable_url", event.target.value)
                    }
                  />
                  <button type="button" onClick={() => submitResult(job.id)} className="primary-button">
                    Отправить результат
                  </button>
                </div>
              </JobCard>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default Dashboard;

