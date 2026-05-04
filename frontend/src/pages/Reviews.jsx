import { useEffect, useState } from "react";
import styles from "./Reviews.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { jobApi, reviewApi } from "../api/client.js";

const Reviews = () => {
  const { user, token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState({ job: "", rating: 5, comment: "" });
  const [status, setStatus] = useState({ type: null, message: "" });

  useEffect(() => {
    const loadReviews = async () => {
      try {
        const filters = user ? { user: user.id } : {};
        const items = await reviewApi.list(filters);
        setReviews(items);
      } catch (error) {
        setStatus({ type: "error", message: error.message });
      }
    };
    loadReviews();
  }, [user]);

  useEffect(() => {
    const loadJobs = async () => {
      if (!token) return;
      try {
        const dashboard = await jobApi.dashboard(token);
        const completed = [...(dashboard.owned || []), ...(dashboard.assigned || [])].filter(
          (job) => job.status === "completed",
        );
        setJobs(completed);
      } catch (error) {
        setStatus({ type: "error", message: error.message });
      }
    };
    loadJobs();
  }, [token]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setStatus({ type: "error", message: "Авторизуйтесь, чтобы оставлять отзывы" });
      return;
    }
    if (!form.job) {
      setStatus({ type: "error", message: "Выберите задание" });
      return;
    }
    try {
      await reviewApi.create(
        {
          job: form.job,
          rating: Number(form.rating),
          comment: form.comment,
        },
        token,
      );
      setStatus({ type: "success", message: "Отзыв отправлен" });
      setForm({ job: "", rating: 5, comment: "" });
      const filters = user ? { user: user.id } : {};
      const items = await reviewApi.list(filters);
      setReviews(items);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  };

  return (
    <div className={`page reviews-page ${styles.root}`}>
      <div className="card">
        <h2>Отзывы о работе</h2>
        <p className="muted-text">
          История сотрудничества между работодателями и исполнителями. Оставляйте отзывы после
          завершения задания.
        </p>
        {user && jobs.length === 0 && (
          <p className="muted-text">Отзывы доступны после завершения хотя бы одного задания.</p>
        )}
        {status.message && (
          <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
        )}
      </div>

      {user && (
        <div className="card review-form-card">
          <h3>Оставить отзыв</h3>
          <form className="form-grid" onSubmit={handleSubmit}>
            <div className="input-group">
              <label>Задание</label>
              <select
                value={form.job}
                onChange={(event) => setForm((prev) => ({ ...prev, job: event.target.value }))}
              >
                <option value="">Выберите задание</option>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Оценка</label>
              <input
                type="number"
                min={1}
                max={5}
                value={form.rating}
                onChange={(event) => setForm((prev) => ({ ...prev, rating: event.target.value }))}
              />
            </div>
            <div className="input-group">
              <label>Комментарий</label>
              <textarea
                rows={4}
                value={form.comment}
                onChange={(event) => setForm((prev) => ({ ...prev, comment: event.target.value }))}
              />
            </div>
            <button className="primary-button">Отправить отзыв</button>
          </form>
        </div>
      )}

      <section className="card">
        <h3>Лента отзывов</h3>
        {reviews.length === 0 && <p className="muted-text">Отзывов пока нет.</p>}
        <div className="reviews-list">
          {reviews.map((review) => (
            <article key={review.id} className="review-card">
              <div className="review-header">
                <strong>Задание: {review.job.title}</strong>
                <span className="rating">★ {review.rating}</span>
              </div>
              <p className="muted-text">
                {review.reviewer.username} → {review.reviewee.username}
              </p>
              {review.comment && <p>{review.comment}</p>}
              <span className="muted-text">
                {new Date(review.created_at).toLocaleDateString("ru-RU")}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Reviews;

