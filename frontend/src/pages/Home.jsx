import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FaCertificate } from "react-icons/fa";
import { hubApi } from "../api/client.js";
import styles from "./Home.module.css";

const highlights = [
  {
    title: "Быстрый старт",
    description: "Создайте аккаунт и начните работу за пару минут с готовыми подсказками и профилем.",
  },
  {
    title: "Управление задачами",
    description: "Публикуйте задания, назначайте исполнителей и отслеживайте прогресс по статусам.",
  },
  {
    title: "Умный поиск",
    description: "Фильтруйте вакансии по категориям, статусу и локации, отправляйте отклики в пару кликов.",
  },
  {
    title: "Чат в стиле мессенджера",
    description: "Список диалогов слева, активный чат справа, синхронные сообщения и непрочитанные.",
  },
  {
    title: "Результаты и отзывы",
    description: "Подтверждайте выполнение, закрывайте отклики и обменивайтесь отзывами после завершения.",
  },
];

function pitchLineIcon(idx) {
  const icons = ["◆", "◇", "▸", "•", "✓", "★"];
  return icons[idx % icons.length];
}

const Home = () => {
  const [featured, setFeatured] = useState([]);
  const [featuredError, setFeaturedError] = useState("");
  const [recommended, setRecommended] = useState([]);
  const [recommendedError, setRecommendedError] = useState("");

  useEffect(() => {
    hubApi
      .featured()
      .then((data) => setFeatured(Array.isArray(data) ? data : []))
      .catch((e) => setFeaturedError(e.message));
  }, []);

  useEffect(() => {
    hubApi
      .recommendedWorkers()
      .then((data) => setRecommended(Array.isArray(data) ? data : []))
      .catch((e) => setRecommendedError(e.message));
  }, []);

  return (
    <main className={`page home-page ${styles.root}`}>
      <section className="card hero">
        <div>
          <p className="badge">Платформа для работодателей и специалистов</p>
          <h1>Единое пространство для задач, диалогов и результата</h1>
          <p className="muted-text">
            Taskora помогает закрывать задачи прозрачно: публикация задания, отклики, назначение, чат,
            проверка результата и отзывы в одном процессе.
          </p>
          <div className="hero-actions">
            <a className="primary-button" href="/register">
              Создать аккаунт
            </a>
            <a className="secondary-button" href="/jobs">
              Найти задания
            </a>
          </div>
        </div>
      </section>

      <section className={`card ${styles.featuredSection}`}>
        <h2>Исполнители на главной</h2>
        <p className="muted-text">
          До 30 карточек (3 в ряд). Размещение с демо-баланса:{" "}
          <strong>100 ₽ на 30 дней</strong> за слот.{" "}
          <Link to="/profile?tab=promo">Оформить как исполнитель</Link>
        </p>
        {featuredError && <p className="error-text">{featuredError}</p>}
        <div className={styles.featuredGrid}>
          {featured.map((slot) => {
            const card = slot.card;
            const prof = card?.profile;
            const lines = Array.isArray(prof?.card_pitch_lines) ? prof.card_pitch_lines : [];
            return (
              <article key={slot.slot_index} className={styles.freelancerCard}>
                {card ? (
                  <Link to={`/u/${card.id}/portfolio`} className={styles.cardLink}>
                    {prof?.card_cover ? (
                      <div className={styles.cardCoverWrap}>
                        <img src={prof.card_cover} alt="" className={styles.cardCoverImg} />
                      </div>
                    ) : null}
                    <div className={styles.cardBody}>
                    <div className={styles.cardHeader}>
                      <div className={styles.avatarWrap}>
                        {prof?.avatar ? (
                          <img src={prof.avatar} alt="" className={styles.avatar} />
                        ) : (
                          <div className={styles.avatarPlaceholder}>
                            {(card.first_name || card.username || "?").slice(0, 1).toUpperCase()}
                          </div>
                        )}
                        {prof?.is_pro ? <span className={styles.proBadge}>PRO</span> : null}
                      </div>
                      <div className={styles.nameBlock}>
                        <div className={styles.nameRow}>
                          <strong className={styles.displayName}>
                            {[card.first_name, card.last_name].filter(Boolean).join(" ") || card.username}
                          </strong>
                          {prof?.is_verified ? (
                            <span className={styles.verifiedBadge} title="Верифицированный исполнитель">
                              <FaCertificate aria-hidden />
                            </span>
                          ) : null}
                        </div>
                        {prof?.card_specialization ? (
                          <span className={styles.specPill}>
                            <span className={styles.specIcon}>◆</span> {prof.card_specialization}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ul className={styles.pitchList}>
                      {lines.slice(0, 6).map((line, i) => (
                        <li key={i}>
                          <span className={styles.pitchIcon}>{pitchLineIcon(i)}</span>
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                    </div>
                  </Link>
                ) : (
                  <div className={styles.emptyCard}>
                    <span className={styles.emptyTitle}>Место свободно</span>
                    <span className="muted-text">Слот {slot.slot_index + 1}</span>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      </section>

      <section className={`card ${styles.featuredSection}`}>
        <h2>Рекомендованные исполнители</h2>
        <p className="muted-text">Подборка по верификации и свежим регистрациям.</p>
        {recommendedError && <p className="error-text">{recommendedError}</p>}
        <div className={styles.featuredGrid}>
          {recommended.map((card) => {
            const prof = card?.profile;
            const lines = Array.isArray(prof?.card_pitch_lines) ? prof.card_pitch_lines : [];
            return (
              <article key={card.id} className={styles.freelancerCard}>
                <Link to={`/u/${card.id}/portfolio`} className={styles.cardLink}>
                  {prof?.card_cover ? (
                    <div className={styles.cardCoverWrap}>
                      <img src={prof.card_cover} alt="" className={styles.cardCoverImg} />
                    </div>
                  ) : null}
                  <div className={styles.cardBody}>
                  <div className={styles.cardHeader}>
                    <div className={styles.avatarWrap}>
                      {prof?.avatar ? (
                        <img src={prof.avatar} alt="" className={styles.avatar} />
                      ) : (
                        <div className={styles.avatarPlaceholder}>
                          {(card.first_name || card.username || "?").slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      {prof?.is_pro ? <span className={styles.proBadge}>PRO</span> : null}
                    </div>
                    <div className={styles.nameBlock}>
                      <div className={styles.nameRow}>
                        <strong className={styles.displayName}>
                          {[card.first_name, card.last_name].filter(Boolean).join(" ") || card.username}
                        </strong>
                        {prof?.is_verified ? (
                          <span className={styles.verifiedBadge} title="Верифицированный исполнитель">
                            <FaCertificate aria-hidden />
                          </span>
                        ) : null}
                      </div>
                      {prof?.card_specialization ? (
                        <span className={styles.specPill}>
                          <span className={styles.specIcon}>◆</span> {prof.card_specialization}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <ul className={styles.pitchList}>
                    {lines.slice(0, 4).map((line, i) => (
                      <li key={i}>
                        <span className={styles.pitchIcon}>{pitchLineIcon(i)}</span>
                        <span>{line}</span>
                      </li>
                    ))}
                  </ul>
                  </div>
                </Link>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card highlights">
        <h2>Основные возможности</h2>
        <div className="highlights-grid">
          {highlights.map((item) => (
            <article key={item.title} className="highlight-card">
              <h3>{item.title}</h3>
              <p>{item.description}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
};

export default Home;
