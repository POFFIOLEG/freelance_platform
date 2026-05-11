import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { jobApi } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./JobDetails.module.css";

const JobDetails = () => {
  const { jobId } = useParams();
  const { token } = useAuth();
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [applyText, setApplyText] = useState("");
  const [bidAmount, setBidAmount] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [contestOpen, setContestOpen] = useState(false);
  const [contestComment, setContestComment] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const data = await jobApi.get(jobId, token);
        setJob(data);
      } catch (error) {
        setStatus({ type: "error", message: error.message });
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [jobId, token]);

  const submitApply = async () => {
    try {
      await jobApi.apply(jobId, { cover_letter: applyText, expected_budget: 0 }, token);
      setStatus({ type: "success", message: "Отклик отправлен" });
      setApplyText("");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitBid = async () => {
    if (!bidAmount) {
      setStatus({ type: "error", message: "Укажите сумму ставки" });
      return;
    }
    try {
      await jobApi.placeBid(jobId, { amount: Number(bidAmount), message: bidMessage }, token);
      setStatus({ type: "success", message: "Ставка отправлена" });
      setBidAmount("");
      setBidMessage("");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  const submitContest = async () => {
    try {
      await jobApi.apply(jobId, { cover_letter: contestComment, expected_budget: 0 }, token);
      setStatus({ type: "success", message: "Работы отправлены на конкурс" });
      setContestComment("");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  if (loading) return <div className="page"><div className="card">Загрузка...</div></div>;
  if (!job) return <div className="page"><div className="card">Задание не найдено</div></div>;

  return (
    <div className={`page ${styles.root}`}>
      <div className="card">
        <h2>{job.title}</h2>
        <p>{job.description}</p>
        <p className="muted-text">Опубликовано: {new Date(job.created_at).toLocaleDateString("ru-RU")}</p>
        <div className={styles.topLinks}>
          <Link to="/jobs">Посмотреть другие {job.is_contest ? "конкурсы" : "вакансии"}</Link>
          <span className="error-text">Пожаловаться</span>
        </div>

        {job.is_exchange ? (
          <section className={styles.formSection}>
            <h3>Сделать ставку</h3>
            <input
              type="number"
              placeholder="Укажите сумму ставки"
              value={bidAmount}
              onChange={(e) => setBidAmount(e.target.value)}
            />
            <textarea
              rows={4}
              placeholder="Комментарий к ставке"
              value={bidMessage}
              onChange={(e) => setBidMessage(e.target.value)}
            />
            <button className="primary-button" type="button" onClick={submitBid}>
              Сделать ставку
            </button>
          </section>
        ) : job.is_contest ? (
          <section className={styles.formSection}>
            {!contestOpen ? (
              <button className="primary-button" type="button" onClick={() => setContestOpen(true)}>
                Принять участие в конкурсе
              </button>
            ) : (
              <>
                <h3>Ваши конкурсные работы</h3>
                <div className={styles.uploadGrid}>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                  <label className={styles.uploadCell}><input type="file" hidden /><span>+</span></label>
                </div>
                <textarea
                  rows={4}
                  placeholder="Комментарий"
                  value={contestComment}
                  onChange={(e) => setContestComment(e.target.value)}
                />
                <label className={styles.checkbox}><input type="checkbox" /> Запретить комментарии под моей работой</label>
                <div className={styles.actions}>
                  <button className="primary-button" type="button" onClick={submitContest}>
                    Отправить работы на конкурс
                  </button>
                  <button className="secondary-button" type="button" onClick={() => setContestOpen(false)}>
                    Отменить добавление
                  </button>
                </div>
              </>
            )}
          </section>
        ) : (
          <section className={styles.formSection}>
            <h3>Ваш отклик</h3>
            <textarea
              rows={6}
              maxLength={5000}
              value={applyText}
              onChange={(e) => setApplyText(e.target.value)}
            />
            <p className="muted-text">Текстовый файл PDF, DOC, ODT, TXT, RTF объемом до 5 МБ</p>
            <button className="primary-button" type="button" onClick={submitApply}>
              Отправить отклик
            </button>
          </section>
        )}

        {status.message && <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>}
      </div>
    </div>
  );
};

export default JobDetails;
