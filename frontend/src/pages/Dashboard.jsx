import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, token, updateProfile, refreshProfile } = useAuth();
  const [data, setData] = useState({ owned: [], assigned: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [applications, setApplications] = useState({});
  const [submissions, setSubmissions] = useState({});
  const [submissionDrafts, setSubmissionDrafts] = useState({});
  const [profileForm, setProfileForm] = useState({
    headline: "",
    bio: "",
    skills: "",
    experience_years: 0,
    hourly_rate: "",
    company: "",
    location: "",
    availability: "",
    portfolio_url: "",
  });
  const [employerView, setEmployerView] = useState("jobs");

  const isEmployer = user?.role === "employer";
  const isWorker = user?.role === "worker";
  const selectedView = searchParams.get("view");

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

  useEffect(() => {
    if (!isEmployer) return;
    if (selectedView === "applications" || selectedView === "jobs") {
      setEmployerView(selectedView);
    }
  }, [isEmployer, selectedView]);

  useEffect(() => {
    if (user?.profile) {
      setProfileForm({
        headline: user.profile.headline || "",
        bio: user.profile.bio || "",
        skills: Array.isArray(user.profile.skills)
          ? user.profile.skills.join(", ")
          : user.profile.skills || "",
        experience_years: user.profile.experience_years || 0,
        hourly_rate: user.profile.hourly_rate || "",
        company: user.profile.company || "",
        location: user.profile.location || "",
        availability: user.profile.availability || "",
        portfolio_url: user.profile.portfolio_url || "",
      });
    } else if (token) {
      refreshProfile();
    }
  }, [user, token, refreshProfile]);

  const loadApplications = async (jobId, { force = false } = {}) => {
    if (!token) return;
    if (!force && applications[jobId]) return;
    try {
      const list = await jobApi.applications(jobId, token);
      setApplications((prev) => ({ ...prev, [jobId]: list }));
    } catch (err) {
      setError(err.message);
    }
  };

  const loadSubmissions = async (jobId, { force = false } = {}) => {
    if (!token) return;
    if (!force && submissions[jobId]) return;
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
    if (draft.deliverable_url) {
      try {
        const url = new URL(draft.deliverable_url);
        if (!["http:", "https:"].includes(url.protocol)) {
          throw new Error("invalid protocol");
        }
      } catch {
        setError("Ссылка на результат должна быть корректным URL (http/https)");
        return;
      }
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

  const approveSubmission = async (jobId, submissionId) => {
    if (!token) return;
    try {
      await jobApi.approveSubmission(jobId, submissionId, token);
      setSuccess("Проверка завершена, результат принят");
      refresh();
      loadSubmissions(jobId);
    } catch (err) {
      setError(err.message);
    }
  };

  const closeApplication = async (jobId, applicationId) => {
    if (!token) return;
    try {
      await jobApi.closeApplication(jobId, applicationId, token);
      setSuccess("Отклик закрыт");
      setApplications((prev) => ({
        ...prev,
        [jobId]: (prev[jobId] || []).filter((item) => item.id !== applicationId),
      }));
      refresh();
    } catch (err) {
      setError(err.message);
    }
  };

  const pickContestWinner = async (jobId) => {
    if (!token) return;
    try {
      const result = await jobApi.pickContestWinner(jobId, token);
      setSuccess(
        `Розыгрыш завершен: выбран ${result?.winner?.worker?.username || "исполнитель"}`,
      );
      refresh();
      setApplications((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
    } catch (err) {
      setError(err.message);
    }
  };

  const saveInlineProfile = async (event) => {
    event.preventDefault();
    if (!token) return;
    try {
      await updateProfile({
        ...user.profile,
        ...profileForm,
        skills: profileForm.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        experience_years: Number(profileForm.experience_years) || 0,
        hourly_rate: profileForm.hourly_rate ? Number(profileForm.hourly_rate) : null,
      });
      setSuccess("Профиль обновлен");
    } catch (err) {
      setError(err.message);
    }
  };

  const ownedJobs = useMemo(() => data.owned || [], [data]);
  const assignedJobs = useMemo(() => data.assigned || [], [data]);
  const applicationsList = useMemo(
    () =>
      Object.entries(applications).flatMap(([jobId, list]) =>
        (list || []).map((application) => ({
          ...application,
          jobId: Number(jobId),
          jobTitle: ownedJobs.find((job) => job.id === Number(jobId))?.title || `Задание #${jobId}`,
        })),
      ),
    [applications, ownedJobs],
  );
  const completedJobsCount = useMemo(
    () => [...ownedJobs, ...assignedJobs].filter((job) => job.status === "completed").length,
    [ownedJobs, assignedJobs],
  );

  useEffect(() => {
    if (!token || !isEmployer || employerView !== "applications" || ownedJobs.length === 0) return;
    Promise.all(ownedJobs.map((job) => loadApplications(job.id, { force: true })));
  }, [token, isEmployer, employerView, ownedJobs.length]);

  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      refresh();
      if (isEmployer && employerView === "applications" && ownedJobs.length > 0) {
        Promise.all(ownedJobs.map((job) => loadApplications(job.id, { force: true })));
      }
      const submissionJobIds = Object.keys(submissions);
      if (submissionJobIds.length > 0) {
        Promise.all(
          submissionJobIds.map((jobId) => loadSubmissions(Number(jobId), { force: true })),
        );
      }
    }, 8000);
    return () => clearInterval(interval);
  }, [token, isEmployer, employerView, ownedJobs, submissions]);

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
        {completedJobsCount > 0 && (
          <p className="muted-text">
            Есть завершенные задания ({completedJobsCount}).{" "}
            <Link to="/reviews" className={styles.link}>
              Оставить отзыв
            </Link>
          </p>
        )}
      </div>

      <section className="card">
        <div className="card-header">
          <h3>Профиль в кабинете</h3>
          <p className="muted-text">Редактируйте ключевые данные прямо здесь.</p>
        </div>
        <form className="form-grid" onSubmit={saveInlineProfile}>
          <p className="badge">
            Пробный баланс: {Number(user.profile?.demo_balance || 0).toLocaleString("ru-RU")} ₽
          </p>
          <div className="input-row">
            <div className="input-group">
              <label>Заголовок</label>
              <input
                value={profileForm.headline}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, headline: event.target.value }))
                }
                placeholder="Например, frontend-разработчик"
              />
            </div>
            <div className="input-group">
              <label>Компания</label>
              <input
                value={profileForm.company}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, company: event.target.value }))
                }
                placeholder="Компания или команда"
              />
            </div>
          </div>
          <div className="input-group">
            <label>Описание</label>
            <textarea
              rows={4}
              value={profileForm.bio}
              onChange={(event) =>
                setProfileForm((prev) => ({ ...prev, bio: event.target.value }))
              }
              placeholder="Расскажите о себе и опыте"
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Опыт (лет)</label>
              <input
                type="number"
                min={0}
                value={profileForm.experience_years}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, experience_years: event.target.value }))
                }
              />
            </div>
            <div className="input-group">
              <label>Ставка (₽/ч)</label>
              <input
                type="number"
                min={0}
                value={profileForm.hourly_rate}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, hourly_rate: event.target.value }))
                }
              />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Навыки (через запятую)</label>
              <input
                value={profileForm.skills}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, skills: event.target.value }))
                }
                placeholder="React, Django, UI"
              />
            </div>
            <div className="input-group">
              <label>Портфолио</label>
              <input
                value={profileForm.portfolio_url}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, portfolio_url: event.target.value }))
                }
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Локация</label>
              <input
                value={profileForm.location}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, location: event.target.value }))
                }
                placeholder="Москва / удаленно"
              />
            </div>
            <div className="input-group">
              <label>Доступность</label>
              <input
                value={profileForm.availability}
                onChange={(event) =>
                  setProfileForm((prev) => ({ ...prev, availability: event.target.value }))
                }
                placeholder="20 ч/нед"
              />
            </div>
          </div>
          <button className="primary-button" type="submit">
            Сохранить профиль
          </button>
        </form>
      </section>

      {isEmployer && (
        <section className="card">
          <div className="card-header">
            <h3>Управление заданиями</h3>
            <label className="input-group">
              <span>Раздел</span>
              <select
                value={employerView}
                onChange={(event) => {
                  const nextView = event.target.value;
                  setEmployerView(nextView);
                  setSearchParams({ view: nextView });
                }}
              >
                <option value="jobs">Мои задания</option>
                <option value="applications">Отклики</option>
              </select>
            </label>
          </div>

          {employerView === "jobs" && (
            <>
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
                      {job.is_contest && (
                        <button
                          className="secondary-button"
                          onClick={() => pickContestWinner(job.id)}
                          type="button"
                        >
                          Разыграть исполнителя
                        </button>
                      )}
                      <button
                        className="secondary-button"
                        onClick={() => loadSubmissions(job.id)}
                        type="button"
                      >
                        Результаты ({job.submissions_count || 0})
                      </button>
                    </div>
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
                            <button
                              className="primary-button"
                              onClick={() => approveSubmission(job.id, item.id)}
                              type="button"
                            >
                              Завершить проверку
                            </button>
                          </article>
                        ))}
                      </div>
                    )}
                  </JobCard>
                ))}
              </div>
            </>
          )}

          {employerView === "applications" && (
            <>
              {ownedJobs.length === 0 && <p className="muted-text">Для ваших заданий пока нет откликов.</p>}
              <div className={styles.applicationsList}>
                {ownedJobs.map((job) => (
                  <button
                    key={job.id}
                    className="secondary-button"
                    type="button"
                    onClick={() => loadApplications(job.id)}
                  >
                    Загрузить отклики по: {job.title}
                  </button>
                ))}
                {applicationsList.length === 0 && (
                  <p className="muted-text">Выберите задание и загрузите отклики.</p>
                )}
                {applicationsList.map((application) => (
                  <div key={application.id} className={styles.applicationCard}>
                    <div>
                      <strong>{application.worker.username}</strong>
                      <p className="muted-text">Задание: {application.jobTitle}</p>
                      <p className="muted-text">{application.cover_letter || "Без комментария"}</p>
                      <p className="muted-text">
                        Бюджет:{" "}
                        {Number(application.expected_budget).toLocaleString("ru-RU", {
                          style: "currency",
                          currency: "RUB",
                        })}
                      </p>
                    </div>
                    <button
                      className="primary-button"
                      onClick={() => handleAssign(application.jobId, application.id)}
                      type="button"
                    >
                      Назначить
                    </button>
                    <button
                      className="secondary-button"
                      onClick={() => closeApplication(application.jobId, application.id)}
                      type="button"
                    >
                      Закрыть отклик
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
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

