import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { hubApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Calendar.module.css";

const CalendarPage = () => {
  const { token } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    hubApi
      .calendar(token)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [token]);

  if (!token) {
    return (
      <div className={`page ${styles.root}`}>
        <div className="card">
          <p>Войдите, чтобы видеть этапы по заданиям и напоминания.</p>
          <Link to="/login">Вход</Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`page ${styles.root}`}>
        <p className="error-text">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`page ${styles.root}`}>
        <p className="muted-text">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className={`page ${styles.root}`}>
      <div className="card">
        <h1>Календарь и этапы</h1>
        <p className="muted-text">Сроки этапов (milestones) и ваши напоминания по сделкам.</p>
        <p>
          <button
            type="button"
            className="secondary-button"
            onClick={async () => {
              try {
                const blob = await hubApi.downloadCalendarXlsx(token);
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "taskora-calendar.xlsx";
                a.click();
                URL.revokeObjectURL(url);
              } catch (e) {
                setError(e.message);
              }
            }}
          >
            Скачать Excel (.xlsx)
          </button>
        </p>
      </div>
      <section className={`card ${styles.section}`}>
        <h2>Этапы</h2>
        {(data.milestones || []).length === 0 && <p className="muted-text">Этапов пока нет.</p>}
        <ul className={styles.list}>
          {(data.milestones || []).map((m) => (
            <li key={m.id}>
              <Link to={`/jobs/${m.job}`}>{m.title}</Link>
              {m.due_date ? <span className="muted-text"> — до {m.due_date}</span> : null}
              {m.is_completed ? <span className={styles.done}> ✓</span> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className={`card ${styles.section}`}>
        <h2>Напоминания</h2>
        {(data.reminders || []).length === 0 && <p className="muted-text">Напоминаний нет.</p>}
        <ul className={styles.list}>
          {(data.reminders || []).map((r) => (
            <li key={r.id}>
              <Link to={`/jobs/${r.job}`}>Задание #{r.job}</Link>
              <span className="muted-text">
                {" "}
                — {new Date(r.fire_at).toLocaleString("ru-RU")} {r.note ? `(${r.note})` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default CalendarPage;
