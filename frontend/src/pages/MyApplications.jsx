import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { jobApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { getApplicationStatusLabel, getJobCardStatus } from "../utils/jobStatusUi.js";
import styles from "./MyApplications.module.css";

const FILTERS = [
  { id: "all", label: "Все" },
  { id: "sent", label: "Отправлен" },
  { id: "shortlisted", label: "В шорт-листе" },
  { id: "accepted", label: "Принят" },
  { id: "rejected", label: "Отклонён" },
];

const MyApplications = () => {
  const { token, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!token || user?.role !== "worker") return;
    let cancelled = false;
    setLoading(true);
    jobApi
      .myApplications(token)
      .then((list) => {
        if (!cancelled) setItems(Array.isArray(list) ? list : []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message || "Ошибка загрузки");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, user?.role]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((j) => (j.application_status || "") === filter);
  }, [items, filter]);

  const counts = useMemo(() => {
    const c = { all: items.length, sent: 0, shortlisted: 0, accepted: 0, rejected: 0 };
    for (const j of items) {
      const s = j.application_status;
      if (s === "sent") c.sent += 1;
      else if (s === "shortlisted") c.shortlisted += 1;
      else if (s === "accepted") c.accepted += 1;
      else if (s === "rejected") c.rejected += 1;
    }
    return c;
  }, [items]);

  if (!token || user?.role !== "worker") {
    return (
      <div className="page">
        <div className="card">
          <p>Раздел доступен исполнителям.</p>
          <Link to="/login">Войти</Link>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page">
        <div className="card">Загрузка…</div>
      </div>
    );
  }

  return (
    <div className={`page ${styles.root}`}>
      <div className="card">
        <h1 className={styles.title}>Мои отклики</h1>
        <p className="muted-text">Заявки, которые вы отправляли заказчикам.</p>

        <div className={styles.tabs}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={filter === f.id ? styles.tabActive : styles.tab}
              onClick={() => setFilter(f.id)}
            >
              {f.label}{" "}
              <span className={styles.tabCount}>
                {f.id === "all" ? counts.all : counts[f.id] ?? 0}
              </span>
            </button>
          ))}
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        {filtered.length === 0 && !error ? (
          <p className="muted-text">В этом разделе пока пусто.</p>
        ) : (
          <ul className={styles.list}>
            {filtered.map((job) => {
              const st = getJobCardStatus(job.status);
              const appStatus = job.application_status || "";
              return (
                <li key={`${job.id}-${job.application_id}`} className={styles.card}>
                  <div className={styles.cardTop}>
                    <Link className={styles.jobTitle} to={`/jobs/${job.id}`}>
                      {job.title}
                    </Link>
                    <span className={styles.budget}>
                      {job.budget_min}–{job.budget_max} ₽
                    </span>
                  </div>
                  <p className={styles.excerpt}>
                    {(job.description || "").slice(0, 220)}
                    {(job.description || "").length > 220 ? "…" : ""}
                  </p>
                  <div className={styles.cardMeta}>
                    <span className={styles.pill}>{st.label}</span>
                    <span className={styles.appTag}>{getApplicationStatusLabel(appStatus)}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default MyApplications;
