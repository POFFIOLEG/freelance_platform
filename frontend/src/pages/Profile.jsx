import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, jobApi, reviewApi } from "../api/client.js";
import styles from "./Profile.module.css";

const defaultProfile = {
  headline: "",
  bio: "",
  skills: "",
  experience_years: 0,
  hourly_rate: "",
  company: "",
  location: "",
  availability: "",
  portfolio_url: "",
};

const Profile = () => {
  const { user, token, updateProfile, refreshProfile, logout } = useAuth();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(defaultProfile);
  const [reviews, setReviews] = useState([]);
  const [ownedJobs, setOwnedJobs] = useState([]);
  const [favoriteJobs, setFavoriteJobs] = useState([]);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [jobsView, setJobsView] = useState("all");
  const [notificationSettings, setNotificationSettings] = useState({
    email_notifications: true,
    push_notifications: true,
    chat_notifications: true,
  });
  const activeTab = params.get("tab") || "jobs";
  const settingsView = params.get("settings") || "main";
  const favoritesKey = `favorite_jobs_${user?.id || "guest"}`;
  const notificationKey = `notification_settings_${user?.id || "guest"}`;

  useEffect(() => {
    if (user?.profile) {
      setForm({
        ...defaultProfile,
        ...user.profile,
        skills: Array.isArray(user.profile.skills) ? user.profile.skills.join(", ") : user.profile.skills || "",
      });
    } else if (token) {
      refreshProfile().then((profile) => {
        if (!profile) return;
        setForm({
          ...defaultProfile,
          ...profile,
          skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : profile.skills || "",
        });
      });
    }
  }, [user, token, refreshProfile]);

  useEffect(() => {
    if (!token) return;
    jobApi
      .dashboard(token)
      .then((data) => setOwnedJobs(data.owned || []))
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
      const ids = Array.isArray(saved) ? saved : [];
      setFavoriteJobs(ownedJobs.filter((job) => ids.includes(job.id)));
    } catch {
      setFavoriteJobs([]);
    }
  }, [favoritesKey, ownedJobs]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(notificationKey) || "null");
      if (saved) {
        setNotificationSettings(saved);
      }
    } catch {
      // ignore bad JSON
    }
  }, [notificationKey]);

  useEffect(() => {
    if (!user) return;
    reviewApi
      .list({ user: user.id })
      .then((items) => setReviews(items))
      .catch(() => {});
  }, [user]);

  const reviewsMeta = useMemo(() => {
    const positive = reviews.filter((item) => Number(item.rating) >= 4).length;
    const negative = reviews.filter((item) => Number(item.rating) <= 2).length;
    return { all: reviews.length, positive, negative };
  }, [reviews]);

  const saveSettings = async (event) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      await updateProfile({
        ...form,
        skills: form.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        experience_years: Number(form.experience_years) || 0,
        hourly_rate: form.hourly_rate ? Number(form.hourly_rate) : null,
      });
      setStatus({ type: "success", message: "Настройки обновлены" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveNotifications = () => {
    localStorage.setItem(notificationKey, JSON.stringify(notificationSettings));
    setStatus({ type: "success", message: "Настройки уведомлений сохранены" });
  };

  const deleteAccount = async () => {
    if (!token) return;
    if (deleteConfirmation.trim() !== "УДАЛИТЬ") {
      setStatus({ type: "error", message: "Введите слово УДАЛИТЬ для подтверждения." });
      return;
    }
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      await authApi.deleteAccount(token);
      localStorage.removeItem(favoritesKey);
      localStorage.removeItem(notificationKey);
      logout();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const visibleJobs = ownedJobs.filter((job) => {
    if (jobsView === "open") {
      return job.status === "open" || job.status === "in_progress" || job.status === "submitted";
    }
    if (jobsView === "closed") {
      return job.status === "completed" || job.status === "cancelled";
    }
    return true;
  });

  const renderContent = () => {
    if (activeTab === "reviews") {
      return (
        <section className={styles.contentPanel}>
          <div className={styles.subTabs}>
            <span>Все {reviewsMeta.all}</span>
            <span>Положительные {reviewsMeta.positive}</span>
            <span>Отрицательные {reviewsMeta.negative}</span>
          </div>
          <h3>Отзывы от фрилансеров за всё время</h3>
          {reviews.length === 0 && <p className="muted-text">Пока отзывов нет.</p>}
          {reviews.map((item) => (
            <article key={item.id} className={styles.reviewRow}>
              <strong>{item.job?.title || "Задание"}</strong>
              <span>Оценка: {item.rating}/5</span>
            </article>
          ))}
        </section>
      );
    }

    if (activeTab === "info") {
      return (
        <section className={styles.contentPanel}>
          <h3>Личная информация</h3>
          <div className={styles.infoGrid}>
            <p><strong>Логин:</strong> {user.username}</p>
            <p><strong>Email:</strong> {user.email || "-"}</p>
            <p><strong>Роль:</strong> {user.role === "employer" ? "Заказчик" : "Исполнитель"}</p>
            <p><strong>Имя / Заголовок:</strong> {form.headline || "-"}</p>
            <p><strong>Компания:</strong> {form.company || "-"}</p>
            <p><strong>Локация:</strong> {form.location || "-"}</p>
            <p><strong>Доступность:</strong> {form.availability || "-"}</p>
            <p><strong>Опыт:</strong> {form.experience_years || 0} лет</p>
            <p><strong>Ставка:</strong> {form.hourly_rate || "-"} ₽/ч</p>
          </div>
        </section>
      );
    }

    if (activeTab === "settings") {
      return (
        <section className={styles.settingsLayout}>
          <aside className={styles.settingsMenu}>
            <button
              className={`${styles.menuItem} ${settingsView === "main" ? styles.menuItemActive : ""}`}
              onClick={() => setParams({ tab: "settings", settings: "main" })}
              type="button"
            >
              Основные настройки
            </button>
            <button
              className={`${styles.menuItem} ${settingsView === "info" ? styles.menuItemActive : ""}`}
              onClick={() => setParams({ tab: "settings", settings: "info" })}
              type="button"
            >
              Информация
            </button>
            <button
              className={`${styles.menuItem} ${settingsView === "favorites" ? styles.menuItemActive : ""}`}
              onClick={() => setParams({ tab: "settings", settings: "favorites" })}
              type="button"
            >
              Избранное
            </button>
            <button
              className={`${styles.menuItem} ${settingsView === "notifications" ? styles.menuItemActive : ""}`}
              onClick={() => setParams({ tab: "settings", settings: "notifications" })}
              type="button"
            >
              Уведомления
            </button>
            <button
              className={`${styles.menuItem} ${settingsView === "delete" ? styles.menuItemActive : ""}`}
              onClick={() => setParams({ tab: "settings", settings: "delete" })}
              type="button"
            >
              Удаление профиля
            </button>
          </aside>
          {settingsView === "main" && (
            <form className={styles.settingsForm} onSubmit={saveSettings}>
              <h3>Основные настройки</h3>
              <label>Имя <input value={form.headline} onChange={(e) => setField("headline", e.target.value)} /></label>
              <label>Компания/Фамилия <input value={form.company} onChange={(e) => setField("company", e.target.value)} /></label>
              <label>Email <input value={user.email || ""} readOnly /></label>
              <label>Заголовок страницы <input value={form.bio} onChange={(e) => setField("bio", e.target.value)} /></label>
              <label>Пароль <input type="password" value="************" readOnly /></label>
              {status.message && (
                <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
              )}
              <button className="primary-button" disabled={loading}>
                {loading ? "Сохраняем..." : "Изменить"}
              </button>
            </form>
          )}

          {settingsView === "info" && (
            <form className={styles.settingsForm} onSubmit={saveSettings}>
              <h3>Редактирование информации</h3>
              <label>Локация <input value={form.location} onChange={(e) => setField("location", e.target.value)} /></label>
              <label>Доступность <input value={form.availability} onChange={(e) => setField("availability", e.target.value)} /></label>
              <label>Опыт (лет) <input type="number" min={0} value={form.experience_years} onChange={(e) => setField("experience_years", e.target.value)} /></label>
              <label>Ставка (₽/ч) <input type="number" min={0} value={form.hourly_rate || ""} onChange={(e) => setField("hourly_rate", e.target.value)} /></label>
              <label>Навыки (через запятую) <input value={form.skills} onChange={(e) => setField("skills", e.target.value)} /></label>
              <label>Портфолио <input value={form.portfolio_url} onChange={(e) => setField("portfolio_url", e.target.value)} /></label>
              <button className="primary-button" disabled={loading}>
                {loading ? "Сохраняем..." : "Сохранить"}
              </button>
            </form>
          )}

          {settingsView === "favorites" && (
            <section className={styles.settingsForm}>
              <h3>Избранные задания</h3>
              {favoriteJobs.length === 0 && <p className="muted-text">Вы пока ничего не добавили в избранное.</p>}
              {favoriteJobs.map((job) => (
                <article key={job.id} className={styles.favoriteItem}>
                  <strong>{job.title}</strong>
                  <p className="muted-text">{job.category || "Без категории"}</p>
                </article>
              ))}
            </section>
          )}

          {settingsView === "notifications" && (
            <section className={styles.settingsForm}>
              <h3>Уведомления</h3>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={notificationSettings.email_notifications}
                  onChange={(e) => setNotificationSettings((prev) => ({ ...prev, email_notifications: e.target.checked }))}
                />
                Email-уведомления
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={notificationSettings.push_notifications}
                  onChange={(e) => setNotificationSettings((prev) => ({ ...prev, push_notifications: e.target.checked }))}
                />
                Push-уведомления
              </label>
              <label className={styles.toggleRow}>
                <input
                  type="checkbox"
                  checked={notificationSettings.chat_notifications}
                  onChange={(e) => setNotificationSettings((prev) => ({ ...prev, chat_notifications: e.target.checked }))}
                />
                Уведомления чата
              </label>
              <button className="primary-button" type="button" onClick={saveNotifications}>
                Сохранить настройки
              </button>
            </section>
          )}

          {settingsView === "delete" && (
            <section className={styles.settingsForm}>
              <h3>Удаление профиля</h3>
              <p className="muted-text">
                Для подтверждения введите слово <strong>УДАЛИТЬ</strong>. После удаления восстановление невозможно.
              </p>
              <input
                className={styles.confirmInput}
                value={deleteConfirmation}
                onChange={(e) => setDeleteConfirmation(e.target.value)}
                placeholder="Введите: УДАЛИТЬ"
              />
              <button
                className={styles.dangerButton}
                type="button"
                onClick={deleteAccount}
                disabled={loading || deleteConfirmation.trim() !== "УДАЛИТЬ"}
              >
                {loading ? "Удаляем..." : "Удалить профиль"}
              </button>
            </section>
          )}
        </section>
      );
    }

    return (
      <section className={styles.contentPanel}>
        <div className={styles.jobsHeader}>
          <button type="button" className={jobsView === "all" ? styles.jobsFilterActive : styles.jobsFilter} onClick={() => setJobsView("all")}>
            Все ({ownedJobs.length})
          </button>
          <button
            type="button"
            className={jobsView === "open" ? styles.jobsFilterActive : styles.jobsFilter}
            onClick={() => setJobsView("open")}
          >
            Открытые ({ownedJobs.filter((job) => job.status === "open" || job.status === "in_progress" || job.status === "submitted").length})
          </button>
          <button
            type="button"
            className={jobsView === "closed" ? styles.jobsFilterActive : styles.jobsFilter}
            onClick={() => setJobsView("closed")}
          >
            Закрытые ({ownedJobs.filter((job) => job.status === "completed" || job.status === "cancelled").length})
          </button>
          <Link to="/post-job" className="primary-button">Разместить заказ</Link>
        </div>
        {visibleJobs.length === 0 && <p className="muted-text">По выбранному фильтру заданий нет.</p>}
        {visibleJobs.map((job) => (
          <article key={job.id} className={styles.ownedJobRow}>
            <div>
              <strong>{job.title}</strong>
              <p className="muted-text">{job.category || "Без категории"}</p>
            </div>
            <span className={`status-pill status-${job.status}`}>{job.status}</span>
          </article>
        ))}
      </section>
    );
  };

  if (!user) {
    return (
      <div className={`page auth-page ${styles.root}`}>
        <div className="card auth-card">
          <h2>Заполните профиль</h2>
          <p>Авторизуйтесь, чтобы видеть и редактировать профиль.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`page ${styles.root}`}>
      <div className={`card ${styles.profileCard}`}>
        <div className={styles.profileHeader}>
          <div className={styles.avatar}>{user.username?.[0]?.toUpperCase() || "U"}</div>
          <div className={styles.profileMeta}>
            <h2>{user.username}</h2>
            <p className="muted-text">
              {user.role === "employer" ? "Заказчик" : "Исполнитель"} • {user.email}
            </p>
            <p className="badge">
              Баланс: {Number(user.profile?.demo_balance || 0).toLocaleString("ru-RU")} ₽
            </p>
          </div>
          <div className={styles.profileStats}>
            <p><strong>Рейтинг:</strong> 0</p>
            <p><strong>Безопасные сделки:</strong> 0</p>
            <p><strong>Отзывы:</strong> 0</p>
          </div>
        </div>

        <div className={styles.tabs}>
          <button type="button" className={activeTab === "jobs" ? styles.activeTab : ""} onClick={() => setParams({ tab: "jobs" })}>Вакансии и конкурсы</button>
          <button type="button" className={activeTab === "reviews" ? styles.activeTab : ""} onClick={() => setParams({ tab: "reviews" })}>Отзывы</button>
          <button type="button" className={activeTab === "info" ? styles.activeTab : ""} onClick={() => setParams({ tab: "info" })}>Информация</button>
          <button type="button" className={activeTab === "settings" ? styles.activeTab : ""} onClick={() => setParams({ tab: "settings" })}>Настройки</button>
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default Profile;

