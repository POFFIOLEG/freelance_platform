import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import styles from "./Reviews.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { reviewApi } from "../api/client.js";

const normalizeList = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const Reviews = () => {
  const { token } = useAuth();
  const [reviews, setReviews] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [status, setStatus] = useState({ type: null, message: "" });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setStatus({ type: null, message: "" });
      try {
        const [items, top] = await Promise.all([
          reviewApi.list({}, token),
          reviewApi.leaderboard(token, { limit: 15 }).catch(() => []),
        ]);
        if (cancelled) return;
        setReviews(normalizeList(items));
        setLeaderboard(Array.isArray(top) ? top : []);
      } catch (error) {
        if (!cancelled) setStatus({ type: "error", message: error.message });
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className={`page reviews-page ${styles.root}`}>
      <div className="card">
        <h2>Отзывы</h2>
        <p className="muted-text">Лента всех опубликованных отзывов на платформе.</p>
        {status.message ? (
          <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
        ) : null}
      </div>

      <section className={`card ${styles.leaderboardCard}`}>
        <h3>Топ по рейтингу</h3>
        <p className="muted-text">Исполнители с наивысшей средней оценкой (не менее одного отзыва).</p>
        {leaderboard.length === 0 ? (
          <p className="muted-text">Пока недостаточно данных для рейтинга.</p>
        ) : (
          <ol className={styles.leaderboardList}>
            {leaderboard.map((row, idx) => (
              <li key={row.id} className={styles.leaderboardRow}>
                <span className={styles.leaderboardRank}>{idx + 1}</span>
                <Link to={`/u/${row.id}/portfolio`} className={styles.leaderboardName}>
                  {row.username}
                </Link>
                <span className={styles.leaderboardStats}>
                  ★ {row.avg_rating}{" "}
                  <span className="muted-text">({row.review_count})</span>
                </span>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h3>Лента отзывов</h3>
        {reviews.length === 0 && <p className="muted-text">Отзывов пока нет.</p>}
        <div className="reviews-list">
          {reviews.map((review) => (
            <article key={review.id} className="review-card">
              <div className="review-header">
                <strong>Задание: {review.job?.title || "—"}</strong>
                <span className="rating">★ {review.rating}</span>
              </div>
              <p className="muted-text">
                {review.reviewer?.username || "—"} → {review.reviewee?.username || "—"}
              </p>
              {review.comment ? <p>{review.comment}</p> : null}
              <span className="muted-text">
                {review.created_at ? new Date(review.created_at).toLocaleDateString("ru-RU") : ""}
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Reviews;
