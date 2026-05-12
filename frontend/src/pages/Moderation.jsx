import { useCallback, useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { hubApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Moderation.module.css";

const Moderation = () => {
  const { user, token } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [kyc, setKyc] = useState([]);
  const [docsByProfile, setDocsByProfile] = useState({});
  const [msg, setMsg] = useState({ type: null, text: "" });
  const [noteByJob, setNoteByJob] = useState({});

  const load = useCallback(async () => {
    if (!token) return;
    const [j, k] = await Promise.all([hubApi.moderationJobs(token), hubApi.moderationKycQueue(token)]);
    setJobs(Array.isArray(j) ? j : []);
    setKyc(Array.isArray(k) ? k : []);
  }, [token]);

  useEffect(() => {
    if (!token || !user?.is_moderator) return;
    load().catch((e) => setMsg({ type: "error", text: e.message }));
  }, [token, user?.is_moderator, load]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (!user.is_moderator) {
    return <Navigate to="/" replace />;
  }

  const loadDocs = async (profileId) => {
    try {
      const list = await hubApi.moderationKycDocs(profileId, token);
      setDocsByProfile((prev) => ({ ...prev, [profileId]: Array.isArray(list) ? list : [] }));
    } catch (e) {
      setMsg({ type: "error", text: e.message });
    }
  };

  return (
    <div className={`page ${styles.root}`}>
      <div className="card">
        <h1>Кабинет модератора</h1>
        <p className="muted-text">Очередь заданий и заявок KYC.</p>
        <button type="button" className="secondary-button" onClick={() => load()}>
          Обновить
        </button>
        {msg.text && (
          <p className={msg.type === "error" ? "error-text" : "success-text"}>{msg.text}</p>
        )}
      </div>

      <section className={`card ${styles.section}`}>
        <h2>Задания на модерации</h2>
        {jobs.length === 0 && <p className="muted-text">Очередь пуста.</p>}
        <ul className={styles.list}>
          {jobs.map((job) => (
            <li key={job.id} className={styles.row}>
              <div>
                <strong>{job.title}</strong>
                <p className="muted-text">
                  #{job.id} · {job.employer?.username}
                </p>
                <Link to={`/jobs/${job.id}`}>Открыть карточку</Link>
              </div>
              <div className={styles.actions}>
                <input
                  placeholder="Причина отклонения"
                  value={noteByJob[job.id] || ""}
                  onChange={(e) => setNoteByJob((p) => ({ ...p, [job.id]: e.target.value }))}
                />
                <button
                  type="button"
                  className="primary-button"
                  onClick={async () => {
                    try {
                      await hubApi.moderationJobDecision(job.id, { action: "approve" }, token);
                      setMsg({ type: "ok", text: "Задание одобрено." });
                      await load();
                    } catch (e) {
                      setMsg({ type: "error", text: e.message });
                    }
                  }}
                >
                  Одобрить
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await hubApi.moderationJobDecision(
                        job.id,
                        { action: "reject", note: noteByJob[job.id] || "" },
                        token,
                      );
                      setMsg({ type: "ok", text: "Задание отклонено." });
                      await load();
                    } catch (e) {
                      setMsg({ type: "error", text: e.message });
                    }
                  }}
                >
                  Отклонить
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className={`card ${styles.section}`}>
        <h2>KYC на проверке</h2>
        {kyc.length === 0 && <p className="muted-text">Нет заявок.</p>}
        <ul className={styles.list}>
          {kyc.map((row) => (
            <li key={row.profile_id} className={styles.row}>
              <div>
                <strong>{row.user?.username}</strong>
                <p className="muted-text">
                  {row.kyc_full_name || "—"} · документов: {row.documents_count}
                </p>
                <button type="button" className="link-button" onClick={() => loadDocs(row.profile_id)}>
                  Показать файлы
                </button>
                {(docsByProfile[row.profile_id] || []).map((d) => (
                  <div key={d.id} className={styles.docLine}>
                    <a href={d.file} target="_blank" rel="noreferrer">
                      {d.doc_type}
                    </a>
                  </div>
                ))}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={async () => {
                    try {
                      await hubApi.moderationKycDecision(row.profile_id, { action: "approve" }, token);
                      setMsg({ type: "ok", text: "KYC подтверждён." });
                      await load();
                    } catch (e) {
                      setMsg({ type: "error", text: e.message });
                    }
                  }}
                >
                  Подтвердить
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await hubApi.moderationKycDecision(row.profile_id, { action: "reject" }, token);
                      setMsg({ type: "ok", text: "KYC отклонён." });
                      await load();
                    } catch (e) {
                      setMsg({ type: "error", text: e.message });
                    }
                  }}
                >
                  Отклонить
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
};

export default Moderation;
