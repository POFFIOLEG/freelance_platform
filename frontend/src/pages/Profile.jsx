import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, jobApi, reviewApi } from "../api/client.js";
import { FAVORITES_STORAGE_EVENT, broadcastFavoritesChanged } from "../constants/favoritesSync.js";
import { getJobCardStatus, getApplicationStatusLabel } from "../utils/jobStatusUi.js";
import styles from "./Profile.module.css";

const defaultProfile = {
  first_name: "",
  last_name: "",
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
  const [appliedJobs, setAppliedJobs] = useState([]);
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
  const [reputation, setReputation] = useState(null);
  const [passwordFields, setPasswordFields] = useState({ password: "", password_confirm: "" });
  const activeTab = params.get("tab") || "jobs";
  const settingsView = params.get("settings") || "main";
  const favoritesKey = `favorite_jobs_${user?.id || "guest"}`;
  const notificationKey = `notification_settings_${user?.id || "guest"}`;

  useEffect(() => {
    if (user?.profile) {
      setForm({
        ...defaultProfile,
        ...user.profile,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        skills: Array.isArray(user.profile.skills) ? user.profile.skills.join(", ") : user.profile.skills || "",
      });
    } else if (token) {
      refreshProfile().then((profile) => {
        if (!profile) return;
        setForm({
          ...defaultProfile,
          ...profile,
          first_name: profile.first_name || "",
          last_name: profile.last_name || "",
          skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : profile.skills || "",
        });
      });
    }
  }, [user, token, refreshProfile]);

  useEffect(() => {
    if (!token) return;
    jobApi
      .dashboard(token)
      .then((data) => {
        setOwnedJobs(data.owned || []);
        setAppliedJobs(data.applied || []);
      })
      .catch(() => {});
  }, [token]);

  const loadFavoriteJobs = useCallback(async () => {
    try {
      const raw = localStorage.getItem(favoritesKey);
      const saved = raw ? JSON.parse(raw) : [];
      const ids = Array.isArray(saved) ? saved : [];
      if (ids.length === 0) {
        setFavoriteJobs([]);
        return;
      }
      const results = await Promise.all(ids.map((id) => jobApi.get(id, token).catch(() => null)));
      const byId = new Map(results.filter(Boolean).map((job) => [job.id, job]));
      setFavoriteJobs(ids.map((id) => byId.get(id)).filter(Boolean));
    } catch {
      setFavoriteJobs([]);
    }
  }, [favoritesKey, token]);

  useEffect(() => {
    loadFavoriteJobs();
    const onStorage = (e) => {
      if (e.key !== favoritesKey) return;
      loadFavoriteJobs();
    };
    const onCustom = (e) => {
      if (e.detail?.key != null && e.detail.key !== favoritesKey) return;
      loadFavoriteJobs();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(FAVORITES_STORAGE_EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(FAVORITES_STORAGE_EVENT, onCustom);
    };
  }, [favoritesKey, loadFavoriteJobs]);

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
      .list({ user: user.id }, token)
      .then((items) => setReviews(Array.isArray(items) ? items : []))
      .catch(() => setReviews([]));
  }, [user, token]);

  useEffect(() => {
    if (!user?.id) {
      setReputation(null);
      return;
    }
    reviewApi
      .summary(user.id, token)
      .then(setReputation)
      .catch(() => setReputation(null));
  }, [user?.id, token]);

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
        first_name: form.first_name,
        last_name: form.last_name,
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

  const saveMainSettings = async (event) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      const payload = {
        first_name: form.first_name,
        last_name: form.last_name,
        headline: form.headline,
      };
      if (passwordFields.password.trim()) {
        payload.password = passwordFields.password;
        payload.password_confirm = passwordFields.password_confirm;
      }
      await updateProfile(payload);
      setPasswordFields({ password: "", password_confirm: "" });
      setStatus({ type: "success", message: "Основные настройки сохранены" });
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
      broadcastFavoritesChanged(favoritesKey);
      logout();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const isEmployer = user.role === "employer";
  const jobsSource = isEmployer ? ownedJobs : appliedJobs;

  const openJobsCount = jobsSource.filter(
    (job) => job.status === "open" || job.status === "in_progress" || job.status === "submitted",
  ).length;
  const closedJobsCount = jobsSource.filter(
    (job) => job.status === "completed" || job.status === "cancelled",
  ).length;

  const visibleJobs = jobsSource.filter((job) => {
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
          <p className={styles.reputationHint}>
            {reputation?.weighting_note ||
              "Итоговый рейтинг в шапке профиля — взвешенный: учитываются свежесть отзыва, масштаб сделки и надёжность автора отзыва."}
            {reputation?.simple_average != null && reputation?.review_count > 0 && (
              <>
                {" "}
                Среднее по звёздам (без сглаживания): {reputation.simple_average} / 5.
              </>
            )}
            {reputation?.public_confidence === "low" && reputation?.review_count > 0 && (
              <> Мало данных — публичная оценка ближе к среднему по платформе.</>
            )}
          </p>
          <h3>Отзывы о вас</h3>
          {reviews.length === 0 && <p className="muted-text">Пока отзывов нет.</p>}
          {reviews.map((item) => (
            <article key={item.id} className={styles.reviewCard}>
              <div className={styles.reviewCardTop}>
                <strong>{item.job?.title || "Задание"}</strong>
                <span className={styles.reviewStars}>{item.rating}/5</span>
              </div>
              <p className={styles.reviewAuthor}>
                От {item.reviewer?.username || "—"}
                {item.created_at
                  ? ` · ${new Date(item.created_at).toLocaleDateString("ru-RU")}`
                  : ""}
              </p>
              {item.comment ? <p className={styles.reviewComment}>{item.comment}</p> : null}
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
            <p><strong>Имя:</strong> {user.first_name || "-"}</p>
            <p><strong>Фамилия:</strong> {user.last_name || "-"}</p>
            <p><strong>Заголовок профиля:</strong> {form.headline || "-"}</p>
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
            <div className={styles.settingsNarrowWrap}>
              <form className={`${styles.settingsForm} ${styles.settingsFormNarrow}`} onSubmit={saveMainSettings}>
                <h3>Основные настройки</h3>
                <label>
                  Имя
                  <input
                    value={form.first_name}
                    onChange={(e) => setField("first_name", e.target.value)}
                    autoComplete="given-name"
                  />
                </label>
                <label>
                  Фамилия
                  <input
                    value={form.last_name}
                    onChange={(e) => setField("last_name", e.target.value)}
                    autoComplete="family-name"
                  />
                </label>
                <label>
                  Email
                  <input value={user.email || ""} readOnly title="Смена email пока недоступна в этой форме" />
                </label>
                <label>
                  Заголовок профиля
                  <input
                    value={form.headline}
                    onChange={(e) => setField("headline", e.target.value)}
                    placeholder="Например: Full-stack разработчик"
                  />
                </label>
                <p className={styles.settingsFieldHint}>
                  Это короткая строка под вашим именем на странице профиля: чем вы занимаетесь или чем полезны
                  заказчикам. Не путайте с именем сайта в браузере — это только текст внутри платформы.
                </p>
                <label>
                  Новый пароль
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordFields.password}
                    onChange={(e) => setPasswordFields((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Оставьте пустым, если не меняете"
                  />
                </label>
                <label>
                  Подтверждение пароля
                  <input
                    type="password"
                    autoComplete="new-password"
                    value={passwordFields.password_confirm}
                    onChange={(e) => setPasswordFields((p) => ({ ...p, password_confirm: e.target.value }))}
                    placeholder="Повторите новый пароль"
                  />
                </label>
                {status.message && (
                  <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
                )}
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Сохраняем..." : "Сохранить"}
                </button>
              </form>
            </div>
          )}

          {settingsView === "info" && (
            <div className={styles.settingsNarrowWrap}>
              <form className={`${styles.settingsForm} ${styles.settingsFormNarrow}`} onSubmit={saveSettings}>
                <h3>Редактирование информации</h3>
                <label>
                  Локация
                  <input value={form.location} onChange={(e) => setField("location", e.target.value)} />
                </label>
                <label>
                  Компания
                  <input
                    value={form.company}
                    onChange={(e) => setField("company", e.target.value)}
                    placeholder="Название компании или ИП"
                  />
                </label>
                <label>
                  Доступность
                  <input value={form.availability} onChange={(e) => setField("availability", e.target.value)} />
                </label>
                <label>
                  Опыт (лет)
                  <input
                    type="number"
                    min={0}
                    value={form.experience_years}
                    onChange={(e) => setField("experience_years", e.target.value)}
                  />
                </label>
                <label>
                  Ставка (₽/ч)
                  <input
                    type="number"
                    min={0}
                    value={form.hourly_rate || ""}
                    onChange={(e) => setField("hourly_rate", e.target.value)}
                  />
                </label>
                <label>
                  Навыки (через запятую)
                  <input value={form.skills} onChange={(e) => setField("skills", e.target.value)} />
                </label>
                <label>
                  Портфолио
                  <input
                    value={form.portfolio_url}
                    onChange={(e) => setField("portfolio_url", e.target.value)}
                    placeholder="https://..."
                    inputMode="url"
                  />
                </label>
                {status.message && (
                  <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
                )}
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Сохраняем..." : "Сохранить"}
                </button>
              </form>
            </div>
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
            <div className={styles.settingsNarrowWrap}>
              <section className={`${styles.settingsForm} ${styles.settingsFormNarrow}`}>
                <h3>Уведомления</h3>
                <p className={styles.settingsFieldHint}>
                  Выберите каналы напоминаний. Настройки хранятся в браузере на этом устройстве.
                </p>
                <label className={styles.checkCard}>
                  <input
                    type="checkbox"
                    className={styles.checkInput}
                    checked={notificationSettings.email_notifications}
                    onChange={(e) =>
                      setNotificationSettings((prev) => ({ ...prev, email_notifications: e.target.checked }))
                    }
                  />
                  <span className={styles.checkMark} aria-hidden />
                  <span className={styles.checkText}>Email-уведомления</span>
                </label>
                <label className={styles.checkCard}>
                  <input
                    type="checkbox"
                    className={styles.checkInput}
                    checked={notificationSettings.push_notifications}
                    onChange={(e) =>
                      setNotificationSettings((prev) => ({ ...prev, push_notifications: e.target.checked }))
                    }
                  />
                  <span className={styles.checkMark} aria-hidden />
                  <span className={styles.checkText}>Push-уведомления</span>
                </label>
                <label className={styles.checkCard}>
                  <input
                    type="checkbox"
                    className={styles.checkInput}
                    checked={notificationSettings.chat_notifications}
                    onChange={(e) =>
                      setNotificationSettings((prev) => ({ ...prev, chat_notifications: e.target.checked }))
                    }
                  />
                  <span className={styles.checkMark} aria-hidden />
                  <span className={styles.checkText}>Уведомления чата</span>
                </label>
                {status.message && (
                  <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
                )}
                <button className="primary-button" type="button" onClick={saveNotifications}>
                  Сохранить настройки
                </button>
              </section>
            </div>
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
            Все ({jobsSource.length})
          </button>
          <button
            type="button"
            className={jobsView === "open" ? styles.jobsFilterActive : styles.jobsFilter}
            onClick={() => setJobsView("open")}
          >
            Открытые ({openJobsCount})
          </button>
          <button
            type="button"
            className={jobsView === "closed" ? styles.jobsFilterActive : styles.jobsFilter}
            onClick={() => setJobsView("closed")}
          >
            Закрытые ({closedJobsCount})
          </button>
          {isEmployer && (
            <Link to="/post-job" className="primary-button">Разместить заказ</Link>
          )}
        </div>
        {!isEmployer && (
          <p className="muted-text" style={{ marginTop: "0.5rem" }}>
            Задания, на которые вы откликнулись. Откройте карточку, чтобы отправить результат или уточнить детали.
          </p>
        )}
        {visibleJobs.length === 0 && (
          <p className="muted-text">
            {isEmployer ? "По выбранному фильтру заданий нет." : "Нет откликов. Найдите задания в разделе «Все задания»."}
          </p>
        )}
        {visibleJobs.map((job) => {
          const cardStatus = getJobCardStatus(job.status);
          return (
            <Link key={job.id} to={`/jobs/${job.id}`} className={styles.jobRowLink}>
              <article className={styles.ownedJobRow}>
                <div className={styles.jobRowMain}>
                  <strong>{job.title}</strong>
                  <p className="muted-text">{job.category || "Без категории"}</p>
                  {!isEmployer && job.my_application_status && (
                    <p className={styles.applicationHint}>
                      {getApplicationStatusLabel(job.my_application_status)}
                    </p>
                  )}
                  {isEmployer && typeof job.applications_count === "number" && (
                    <p className="muted-text">Откликов: {job.applications_count}</p>
                  )}
                </div>
                <span
                  className={`status-pill ${styles.profileStatusPill} ${styles[`profileStatus_${cardStatus.group}`]}`}
                >
                  {cardStatus.label}
                </span>
              </article>
            </Link>
          );
        })}
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
            <p>
              <strong>Рейтинг:</strong>{" "}
              {reputation?.public_rating_display != null
                ? `${reputation.public_rating_display} ★`
                : "—"}
            </p>
            <p>
              <strong>Успешные сделки:</strong> {reputation?.completed_deals ?? 0}
            </p>
            <p>
              <strong>Отзывов:</strong> {reputation?.review_count ?? 0}
            </p>
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

