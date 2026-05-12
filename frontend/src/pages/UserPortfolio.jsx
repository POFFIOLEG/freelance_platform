import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { authApi } from "../api/client.js";
import styles from "./UserPortfolio.module.css";

const UserPortfolio = () => {
  const { userId } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    authApi
      .publicPortfolio(userId)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [userId]);

  if (error) {
    return (
      <div className={`page ${styles.root}`}>
        <div className="card">
          <p className="error-text">{error}</p>
          <Link to="/">На главную</Link>
        </div>
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

  const card = data.card;
  const prof = card?.profile;
  const rep = data.reputation;

  return (
    <div className={`page ${styles.root}`}>
      <header className={`card ${styles.header}`}>
        <div className={styles.heroRow}>
          {prof?.avatar ? (
            <img src={prof.avatar} alt="" className={styles.bigAvatar} />
          ) : (
            <div className={styles.bigAvatarPlaceholder}>
              {(card.first_name || card.username || "?").slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className={styles.title}>
              {[card.first_name, card.last_name].filter(Boolean).join(" ") || card.username}
              {prof?.is_verified ? <span className={styles.verified}>Проверен</span> : null}
              {prof?.is_pro ? <span className={styles.pro}>PRO</span> : null}
            </h1>
            {prof?.headline ? <p className={styles.headline}>{prof.headline}</p> : null}
            <div className={styles.meta}>
              {prof?.location ? <span>{prof.location}</span> : null}
              {prof?.hourly_rate ? <span>от {prof.hourly_rate} ₽/ч</span> : null}
            </div>
            <div className={styles.social}>
              {prof?.social_telegram ? <span>Telegram: {prof.social_telegram}</span> : null}
              {prof?.social_vk ? (
                <a href={prof.social_vk} target="_blank" rel="noreferrer">
                  ВКонтакте
                </a>
              ) : null}
            </div>
            {rep ? (
              <p className="muted-text">
                Репутация: {rep.public_rating_display ?? "—"} ★ (простое среднее {rep.simple_average ?? "—"}), отзывов:{" "}
                {rep.review_count ?? 0}
              </p>
            ) : null}
          </div>
        </div>
      </header>

      <section className={`card ${styles.portfolio}`}>
        <h2>Портфолио</h2>
        <div className={styles.works}>
          {(data.portfolio || []).length === 0 && <p className="muted-text">Работы ещё не добавлены.</p>}
          {(data.portfolio || []).map((item) => (
            <article key={item.id} className={styles.workCard}>
              {item.image ? <img src={item.image} alt="" className={styles.workImg} /> : null}
              <h3>{item.title}</h3>
              {item.description ? <p className={styles.workDesc}>{item.description}</p> : null}
              {item.link ? (
                <a href={item.link} target="_blank" rel="noreferrer">
                  Ссылка на работу
                </a>
              ) : null}
            </article>
          ))}
        </div>
        <p className={styles.back}>
          <Link to="/">← На главную</Link>
        </p>
      </section>
    </div>
  );
};

export default UserPortfolio;
