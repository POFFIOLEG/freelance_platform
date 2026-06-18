import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCertificate } from "react-icons/fa";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { authApi, hubApi, jobApi, reviewApi } from "../api/client.js";
import { FAVORITES_STORAGE_EVENT, broadcastFavoritesChanged } from "../constants/favoritesSync.js";
import { getJobCardStatus, getApplicationStatusLabel } from "../utils/jobStatusUi.js";
import PortfolioWorkWizard from "../components/PortfolioWorkWizard.jsx";
import styles from "./Profile.module.css";

function savedSearchQueryToSearchParams(query) {
  if (!query || typeof query !== "object") return "";
  const p = new URLSearchParams();
  if (query.q) p.set("q", query.q);
  if (Array.isArray(query.categoryIds) && query.categoryIds.length) {
    p.set("categoryIds", query.categoryIds.join(","));
  }
  if (Array.isArray(query.subcategoryIds) && query.subcategoryIds.length) {
    p.set("subcategoryIds", query.subcategoryIds.join(","));
  }
  if (query.country && query.country !== "all") p.set("country", query.country);
  if (query.city && query.city !== "all") p.set("city", query.city);
  if (query.budget_from) p.set("budget_from", String(query.budget_from));
  if (query.budget_to) p.set("budget_to", String(query.budget_to));
  if (query.urgent) p.set("urgent", "1");
  if (query.without_assignee) p.set("without_assignee", "1");
  if (query.type) p.set("type", query.type);
  return p.toString();
}

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
  card_specialization: "",
  card_pitch_lines: "",
  kyc_full_name: "",
  kyc_comment: "",
  social_telegram: "",
  social_vk: "",
};

const BANNER = {
  saved: "saved",
  promo: "promo",
  settingsMain: "settings-main",
  settingsInfo: "settings-info",
  settingsKyc: "settings-kyc",
  settingsNotif: "settings-notifications",
  settingsDelete: "settings-delete",
};

const Profile = () => {
  const { user, token, updateProfile, refreshProfile, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(defaultProfile);
  const [reviews, setReviews] = useState([]);
  const [ownedJobs, setOwnedJobs] = useState([]);
  const [appliedJobs, setAppliedJobs] = useState([]);
  const [favoriteJobs, setFavoriteJobs] = useState([]);
  const [banner, setBanner] = useState({ key: null, type: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [jobsView, setJobsView] = useState("all");
  const [notificationSettings, setNotificationSettings] = useState({
    push_notifications: true,
    chat_notifications: true,
  });
  const [reputation, setReputation] = useState(null);
  const [passwordFields, setPasswordFields] = useState({ password: "", password_confirm: "" });
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [settingsFieldErrors, setSettingsFieldErrors] = useState({});
  const [slotIndex, setSlotIndex] = useState(0);
  const [featuredMsg, setFeaturedMsg] = useState("");
  const [savedSearches, setSavedSearches] = useState([]);
  const [kycDocs, setKycDocs] = useState([]);
  const kycFileInputFront = useRef(null);
  const kycFileInputBack = useRef(null);
  const kycFileInputSelfie = useRef(null);
  const activeTab = params.get("tab") || "jobs";
  const settingsView = params.get("settings") || "main";
  const favoritesKey = `favorite_jobs_${user?.id || "guest"}`;
  const notificationKey = `notification_settings_${user?.id || "guest"}`;

  useEffect(() => {
    setBanner({ key: null, type: null, message: "" });
  }, [activeTab, settingsView]);

  const renderBanner = (slot) =>
    banner.key === slot && banner.message ? (
      <p className={banner.type === "error" ? "error-text" : "success-text"}>{banner.message}</p>
    ) : null;

  useEffect(() => {
    if (user?.profile) {
      setForm({
        ...defaultProfile,
        ...user.profile,
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        skills: Array.isArray(user.profile.skills) ? user.profile.skills.join(", ") : user.profile.skills || "",
        card_specialization: user.profile.card_specialization || "",
        card_pitch_lines: Array.isArray(user.profile.card_pitch_lines)
          ? user.profile.card_pitch_lines.join("\n")
          : "",
        kyc_full_name: user.profile.kyc_full_name || "",
        kyc_comment: user.profile.kyc_comment || "",
        social_telegram: user.profile.social_telegram || "",
        social_vk: user.profile.social_vk || "",
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
          card_specialization: profile.card_specialization || "",
          card_pitch_lines: Array.isArray(profile.card_pitch_lines) ? profile.card_pitch_lines.join("\n") : "",
          kyc_full_name: profile.kyc_full_name || "",
          kyc_comment: profile.kyc_comment || "",
          social_telegram: profile.social_telegram || "",
          social_vk: profile.social_vk || "",
        });
      });
    }
  }, [user, token, refreshProfile]);

  useEffect(() => {
    if (!token || user?.role !== "worker") return;
    const needPortfolio = activeTab === "settings" && settingsView === "info";
    if (!needPortfolio) return;
    authApi
      .portfolioList(token)
      .then((list) => setPortfolioItems(Array.isArray(list) ? list : []))
      .catch(() => setPortfolioItems([]));
  }, [token, activeTab, settingsView, user?.role]);

  useEffect(() => {
    if (!token || activeTab !== "settings" || settingsView !== "kyc") return;
    authApi
      .kycDocumentsList(token)
      .then((list) => setKycDocs(Array.isArray(list) ? list : []))
      .catch(() => setKycDocs([]));
  }, [token, activeTab, settingsView]);

  useEffect(() => {
    if (!token || activeTab !== "saved") return;
    hubApi
      .savedSearchesList(token)
      .then((list) => setSavedSearches(Array.isArray(list) ? list : []))
      .catch(() => setSavedSearches([]));
  }, [token, activeTab]);

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
      if (saved && typeof saved === "object") {
        setNotificationSettings({
          push_notifications: saved.push_notifications !== false,
          chat_notifications: saved.chat_notifications !== false,
        });
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
    setBanner({ key: null, type: null, message: "" });
    setSettingsFieldErrors({});
    const portfolioUrlRaw = (form.portfolio_url || "").trim();
    const portfolio_url =
      portfolioUrlRaw === ""
        ? ""
        : /^https?:\/\//i.test(portfolioUrlRaw)
          ? portfolioUrlRaw
          : `https://${portfolioUrlRaw}`;
    try {
      await updateProfile({
        location: form.location,
        company: form.company,
        availability: form.availability,
        experience_years: Number(form.experience_years) || 0,
        hourly_rate: form.hourly_rate === "" || form.hourly_rate == null ? null : Number(form.hourly_rate),
        skills: form.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
        portfolio_url,
      });
      setBanner({ key: BANNER.settingsInfo, type: "success", message: "Настройки обновлены" });
      setSettingsFieldErrors({});
    } catch (error) {
      setSettingsFieldErrors(error.fields || {});
      setBanner({ key: BANNER.settingsInfo, type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const saveMainSettings = async (event) => {
    event.preventDefault();
    if (!token) return;
    setLoading(true);
    setBanner({ key: null, type: null, message: "" });
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
      setBanner({ key: BANNER.settingsMain, type: "success", message: "Основные настройки сохранены" });
    } catch (error) {
      setBanner({ key: BANNER.settingsMain, type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const saveNotifications = () => {
    localStorage.setItem(notificationKey, JSON.stringify(notificationSettings));
    setBanner({ key: BANNER.settingsNotif, type: "success", message: "Настройки уведомлений сохранены" });
  };

  const deleteAccount = async () => {
    if (!token) return;
    if (deleteConfirmation.trim() !== "УДАЛИТЬ") {
      setBanner({ key: BANNER.settingsDelete, type: "error", message: "Введите слово УДАЛИТЬ для подтверждения." });
      return;
    }
    setLoading(true);
    setBanner({ key: null, type: null, message: "" });
    try {
      await authApi.deleteAccount(token);
      localStorage.removeItem(favoritesKey);
      localStorage.removeItem(notificationKey);
      broadcastFavoritesChanged(favoritesKey);
      logout();
    } catch (error) {
      setBanner({ key: BANNER.settingsDelete, type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className={`page auth-page ${styles.root}`}>
        <div className="card auth-card">
          <p className="muted-text">Загрузка профиля…</p>
        </div>
      </div>
    );
  }

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
    if (activeTab === "saved") {
      return (
        <section className={styles.contentPanel}>
          <h3>Сохранённые поиски</h3>
          {renderBanner(BANNER.saved)}
          <p className="muted-text">
            Сохраняйте фильтры на странице «Все задания», затем открывайте их отсюда.
          </p>
          {savedSearches.length === 0 && <p className="muted-text">Пока нет сохранённых поисков.</p>}
          <ul className={styles.savedSearchList}>
            {savedSearches.map((s) => (
              <li key={s.id} className={styles.savedSearchRow}>
                <div>
                  <strong>{s.name}</strong>
                  <p className="muted-text">
                    {s.created_at ? new Date(s.created_at).toLocaleString("ru-RU") : ""}
                  </p>
                </div>
                <div className={styles.savedSearchActions}>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => {
                      const q = savedSearchQueryToSearchParams(s.query);
                      navigate(q ? `/jobs?${q}` : "/jobs");
                    }}
                  >
                    Применить
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={async () => {
                      try {
                        await hubApi.savedSearchDelete(s.id, token);
                        setSavedSearches((prev) => prev.filter((x) => x.id !== s.id));
                        setBanner({ key: BANNER.saved, type: "success", message: "Поиск удалён" });
                      } catch (e) {
                        setBanner({ key: BANNER.saved, type: "error", message: e.message });
                      }
                    }}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      );
    }

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

    if (activeTab === "promo" && user.role === "worker") {
      return (
        <section className={styles.contentPanel}>
          <div className={styles.promoColumn}>
            <header className={styles.promoHeader}>
              <h3 className={styles.promoTitle}>Карточка на главной</h3>
              <p className={`muted-text ${styles.promoLead}`}>
                Работы портфолио добавляйте в разделе{" "}
                <strong>Настройки → Информация</strong> — там же ссылка, как видят заказчики.
              </p>
            </header>
            {renderBanner(BANNER.promo)}

            <section className={styles.promoSection}>
              <h4>Карточка в блоке на главной</h4>
              <div className={styles.promoCardCoverBlock}>
                <span className={styles.promoCardCoverLabel}>Баннер на карточке</span>
                <p className="muted-text" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
                  JPG, PNG или WebP — показывается сверху карточки на главной (до 10 МБ).
                </p>
                {user.profile?.card_cover ? (
                  <img src={user.profile.card_cover} alt="" className={styles.promoCardCoverPreview} />
                ) : null}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    const fd = new FormData();
                    fd.append("card_cover", file);
                    try {
                      await authApi.uploadCardCover(fd, token);
                      await refreshProfile();
                      setBanner({ key: BANNER.promo, type: "success", message: "Изображение карточки обновлено" });
                    } catch (err) {
                      setBanner({ key: BANNER.promo, type: "error", message: err.message });
                    }
                    e.target.value = "";
                  }}
                />
              </div>
              <p className="muted-text">
                <strong>Специализация (синяя плашка)</strong>
              </p>
              <input
                value={form.card_specialization}
                onChange={(e) => setForm((p) => ({ ...p, card_specialization: e.target.value }))}
                placeholder="Например: Копирайтинг"
              />
              <p className="muted-text">
                <strong>Короткие пункты (с новой строки, до 24 шт.)</strong>
              </p>
              <textarea
                rows={6}
                value={form.card_pitch_lines}
                onChange={(e) => setForm((p) => ({ ...p, card_pitch_lines: e.target.value }))}
                placeholder={"Первая строка\nВторая строка"}
              />
              <div className={styles.promoActions}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      const lines = form.card_pitch_lines
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean);
                      await authApi.profile.update(
                        {
                          card_specialization: form.card_specialization,
                          card_pitch_lines: lines,
                        },
                        token,
                      );
                      await refreshProfile();
                      setBanner({ key: BANNER.promo, type: "success", message: "Карточка сохранена" });
                    } catch (err) {
                      setBanner({ key: BANNER.promo, type: "error", message: err.message });
                    }
                  }}
                >
                  Сохранить текст карточки
                </button>
              </div>
            </section>

            <section className={styles.promoSection}>
              <h4>Соцсети (для портфолио)</h4>
              <input
                placeholder="Telegram @username"
                value={form.social_telegram}
                onChange={(e) => setForm((p) => ({ ...p, social_telegram: e.target.value }))}
              />
              <input
                placeholder="ВКонтакте (URL)"
                value={form.social_vk}
                onChange={(e) => setForm((p) => ({ ...p, social_vk: e.target.value }))}
              />
              <div className={styles.promoActions}>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={async () => {
                    try {
                      await authApi.profile.update(
                        { social_telegram: form.social_telegram, social_vk: form.social_vk },
                        token,
                      );
                      await refreshProfile();
                      setBanner({ key: BANNER.promo, type: "success", message: "Соцсети сохранены" });
                    } catch (err) {
                      setBanner({ key: BANNER.promo, type: "error", message: err.message });
                    }
                  }}
                >
                  Сохранить соцсети
                </button>
              </div>
            </section>

            <section className={styles.promoSection}>
              <h4>Слот на главной — 100 ₽ / 30 дней</h4>
              <p className="muted-text">Номер слота от 0 до 29 (как на главной странице).</p>
              <input
                type="number"
                min={0}
                max={29}
                value={slotIndex}
                onChange={(e) => setSlotIndex(Number(e.target.value))}
              />
              <div className={styles.promoActions}>
                <button
                  type="button"
                  className="primary-button"
                  onClick={async () => {
                    setFeaturedMsg("");
                    try {
                      await hubApi.purchaseFeatured(slotIndex, token);
                      setFeaturedMsg("Слот оплачен и продлён.");
                    } catch (err) {
                      setFeaturedMsg(err.message);
                    }
                  }}
                >
                  Оплатить с демо-баланса
                </button>
              </div>
              {featuredMsg ? <p className="muted-text">{featuredMsg}</p> : null}
            </section>
          </div>
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
            {user.role === "worker" ? (
              <button
                className={`${styles.menuItem} ${settingsView === "kyc" ? styles.menuItemActive : ""}`}
                onClick={() => setParams({ tab: "settings", settings: "kyc" })}
                type="button"
              >
                Верификация
              </button>
            ) : null}
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
                {renderBanner(BANNER.settingsMain)}
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
                {renderBanner(BANNER.settingsInfo)}
                <div className={styles.settingsAvatarBlock}>
                  <span>Фото профиля</span>
                  <div className={styles.settingsAvatarPreview} aria-hidden>
                    {user.profile?.avatar ? (
                      <img src={user.profile.avatar} alt="" className={styles.settingsAvatarPreviewImg} />
                    ) : (
                      <div className={styles.settingsAvatarPlaceholder}>
                        {user.username?.[0]?.toUpperCase() || "?"}
                      </div>
                    )}
                  </div>
                  <p className="muted-text" style={{ margin: "0 0 0.5rem", fontSize: "0.88rem" }}>
                    JPG, PNG или WebP. После выбора файла фото сразу загрузится на сервер.
                  </p>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const fd = new FormData();
                      fd.append("avatar", file);
                      try {
                        await authApi.uploadAvatar(fd, token);
                        await refreshProfile();
                        setBanner({ key: BANNER.settingsInfo, type: "success", message: "Фото обновлено" });
                      } catch (err) {
                        setBanner({ key: BANNER.settingsInfo, type: "error", message: err.message });
                      }
                      e.target.value = "";
                    }}
                  />
                </div>
                <label>
                  Локация
                  <input value={form.location} onChange={(e) => setField("location", e.target.value)} />
                  {settingsFieldErrors.location ? (
                    <span className="error-text">{settingsFieldErrors.location}</span>
                  ) : null}
                </label>
                <label>
                  Компания
                  <input
                    value={form.company}
                    onChange={(e) => setField("company", e.target.value)}
                    placeholder="Название компании или ИП"
                  />
                  {settingsFieldErrors.company ? (
                    <span className="error-text">{settingsFieldErrors.company}</span>
                  ) : null}
                </label>
                <label>
                  Доступность
                  <input value={form.availability} onChange={(e) => setField("availability", e.target.value)} />
                  {settingsFieldErrors.availability ? (
                    <span className="error-text">{settingsFieldErrors.availability}</span>
                  ) : null}
                </label>
                <label>
                  Опыт (лет)
                  <input
                    type="number"
                    min={0}
                    value={form.experience_years}
                    onChange={(e) => setField("experience_years", e.target.value)}
                  />
                  {settingsFieldErrors.experience_years ? (
                    <span className="error-text">{settingsFieldErrors.experience_years}</span>
                  ) : null}
                </label>
                <label>
                  Ставка (₽/ч)
                  <input
                    type="number"
                    min={0}
                    value={form.hourly_rate || ""}
                    onChange={(e) => setField("hourly_rate", e.target.value)}
                  />
                  {settingsFieldErrors.hourly_rate ? (
                    <span className="error-text">{settingsFieldErrors.hourly_rate}</span>
                  ) : null}
                </label>
                <label>
                  Навыки (через запятую)
                  <input value={form.skills} onChange={(e) => setField("skills", e.target.value)} />
                  {settingsFieldErrors.skills ? (
                    <span className="error-text">{settingsFieldErrors.skills}</span>
                  ) : null}
                </label>
                {user.role === "employer" ? (
                  <label>
                    Сайт или внешнее портфолио (ссылка)
                    <input
                      value={form.portfolio_url}
                      onChange={(e) => setField("portfolio_url", e.target.value)}
                      placeholder="https://..."
                      inputMode="url"
                    />
                    {settingsFieldErrors.portfolio_url ? (
                      <span className="error-text">{settingsFieldErrors.portfolio_url}</span>
                    ) : null}
                  </label>
                ) : (
                  <div className={styles.portfolioSettingsBlock}>
                    <h4 className={styles.portfolioSettingsTitle}>Работы в портфолио</h4>
                    <p className={styles.settingsFieldHint}>
                      Добавляйте кейсы пошагово: обложка, файлы, описание, ссылка и видео, раздел и навыки.{" "}
                      <Link to={`/u/${user.id}/portfolio`} target="_blank" rel="noreferrer">
                        Как видят заказчики
                      </Link>
                    </p>
                    <ul className={styles.portfolioSettingsList}>
                      {portfolioItems.map((it) => (
                        <li key={it.id} className={styles.portfolioSettingsRow}>
                          <div>
                            <strong>{it.title}</strong>
                            {it.link ? (
                              <a href={it.link} target="_blank" rel="noreferrer" className={styles.portfolioSettingsLink}>
                                {it.link}
                              </a>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            className="link-button"
                            onClick={async () => {
                              try {
                                await authApi.portfolioDelete(it.id, token);
                                setPortfolioItems((prev) => prev.filter((x) => x.id !== it.id));
                              } catch (err) {
                                setBanner({ key: BANNER.settingsInfo, type: "error", message: err.message });
                              }
                            }}
                          >
                            Удалить
                          </button>
                        </li>
                      ))}
                    </ul>
                    {portfolioItems.length === 0 && (
                      <p className="muted-text">Пока нет работ — добавьте первую ниже.</p>
                    )}
                    <PortfolioWorkWizard
                      token={token}
                      onAdded={(item) => {
                        setPortfolioItems((p) => [...p, item]);
                        setBanner({ key: BANNER.settingsInfo, type: "success", message: "Работа добавлена." });
                      }}
                    />
                    <label>
                      Дополнительная внешняя ссылка (необязательно)
                      <input
                        value={form.portfolio_url}
                        onChange={(e) => setField("portfolio_url", e.target.value)}
                        placeholder="Behance, личный сайт…"
                        inputMode="url"
                      />
                      {settingsFieldErrors.portfolio_url ? (
                        <span className="error-text">{settingsFieldErrors.portfolio_url}</span>
                      ) : null}
                    </label>
                  </div>
                )}
                {settingsFieldErrors.non_field_errors ? (
                  <p className="error-text">{settingsFieldErrors.non_field_errors}</p>
                ) : null}
                <button className="primary-button" type="submit" disabled={loading}>
                  {loading ? "Сохраняем..." : "Сохранить"}
                </button>
              </form>
            </div>
          )}

          {settingsView === "kyc" && user.role === "worker" && (
            <div className={styles.settingsNarrowWrap}>
              <div className={`${styles.settingsForm} ${styles.settingsFormNarrow}`}>
                <h3>Верификация</h3>
                {renderBanner(BANNER.settingsKyc)}
                <p className="muted-text">Статус: {user.profile?.kyc_status || "—"}</p>
                <label>
                  ФИО как в документе
                  <input
                    placeholder="ФИО как в документе"
                    value={form.kyc_full_name}
                    onChange={(e) => setForm((p) => ({ ...p, kyc_full_name: e.target.value }))}
                  />
                </label>

                <h4 className={styles.kycDocHeading}>Фото документов</h4>
                <p className="muted-text">
                  Загрузите три снимка: лицевая и оборот документа, селфи с документом в руке. После загрузки файлов
                  статус может смениться на «На проверке».
                </p>

                <div className={styles.kycUploadBlock}>
                  <span className={styles.kycUploadLabel}>Документ (лицевая сторона)</span>
                  <div className={styles.kycDocFormRow}>
                    <input ref={kycFileInputFront} type="file" accept="image/*" />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={async () => {
                        const file = kycFileInputFront.current?.files?.[0];
                        if (!file) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: "Выберите файл." });
                          return;
                        }
                        const fd = new FormData();
                        fd.append("doc_type", "id_front");
                        fd.append("file", file);
                        try {
                          await authApi.kycDocumentUpload(fd, token);
                          if (kycFileInputFront.current) kycFileInputFront.current.value = "";
                          const list = await authApi.kycDocumentsList(token);
                          setKycDocs(Array.isArray(list) ? list : []);
                          await refreshProfile();
                          setBanner({ key: BANNER.settingsKyc, type: "success", message: "Файл загружен" });
                        } catch (err) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: err.message });
                        }
                      }}
                    >
                      Загрузить
                    </button>
                  </div>
                </div>

                <div className={styles.kycUploadBlock}>
                  <span className={styles.kycUploadLabel}>Документ (оборот)</span>
                  <div className={styles.kycDocFormRow}>
                    <input ref={kycFileInputBack} type="file" accept="image/*" />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={async () => {
                        const file = kycFileInputBack.current?.files?.[0];
                        if (!file) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: "Выберите файл." });
                          return;
                        }
                        const fd = new FormData();
                        fd.append("doc_type", "id_back");
                        fd.append("file", file);
                        try {
                          await authApi.kycDocumentUpload(fd, token);
                          if (kycFileInputBack.current) kycFileInputBack.current.value = "";
                          const list = await authApi.kycDocumentsList(token);
                          setKycDocs(Array.isArray(list) ? list : []);
                          await refreshProfile();
                          setBanner({ key: BANNER.settingsKyc, type: "success", message: "Файл загружен" });
                        } catch (err) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: err.message });
                        }
                      }}
                    >
                      Загрузить
                    </button>
                  </div>
                </div>

                <div className={styles.kycUploadBlock}>
                  <span className={styles.kycUploadLabel}>Селфи с документом</span>
                  <div className={styles.kycDocFormRow}>
                    <input ref={kycFileInputSelfie} type="file" accept="image/*" />
                    <button
                      type="button"
                      className="primary-button"
                      onClick={async () => {
                        const file = kycFileInputSelfie.current?.files?.[0];
                        if (!file) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: "Выберите файл." });
                          return;
                        }
                        const fd = new FormData();
                        fd.append("doc_type", "selfie");
                        fd.append("file", file);
                        try {
                          await authApi.kycDocumentUpload(fd, token);
                          if (kycFileInputSelfie.current) kycFileInputSelfie.current.value = "";
                          const list = await authApi.kycDocumentsList(token);
                          setKycDocs(Array.isArray(list) ? list : []);
                          await refreshProfile();
                          setBanner({ key: BANNER.settingsKyc, type: "success", message: "Файл загружен" });
                        } catch (err) {
                          setBanner({ key: BANNER.settingsKyc, type: "error", message: err.message });
                        }
                      }}
                    >
                      Загрузить
                    </button>
                  </div>
                </div>

                <ul className={styles.kycDocList}>
                  {kycDocs.map((d) => (
                    <li key={d.id}>
                      <span>{d.doc_type}</span>
                      {d.file ? (
                        <a href={d.file} target="_blank" rel="noreferrer">
                          открыть
                        </a>
                      ) : null}
                      <button
                        type="button"
                        className="link-button"
                        onClick={async () => {
                          try {
                            await authApi.kycDocumentDelete(d.id, token);
                            setKycDocs((prev) => prev.filter((x) => x.id !== d.id));
                          } catch (err) {
                            setBanner({ key: BANNER.settingsKyc, type: "error", message: err.message });
                          }
                        }}
                      >
                        Удалить
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  className="primary-button"
                  style={{ marginTop: "0.5rem" }}
                  onClick={async () => {
                    try {
                      await authApi.profile.update({ kyc_full_name: form.kyc_full_name }, token);
                      await refreshProfile();
                      setBanner({
                        key: BANNER.settingsKyc,
                        type: "success",
                        message: "Данные отправлены на проверку",
                      });
                    } catch (err) {
                      setBanner({ key: BANNER.settingsKyc, type: "error", message: err.message });
                    }
                  }}
                >
                  Отправить на проверку
                </button>
              </div>
            </div>
          )}

          {settingsView === "kyc" && user.role !== "worker" && (
            <div className={styles.settingsNarrowWrap}>
              <p className="muted-text">Раздел верификации доступен исполнителям.</p>
            </div>
          )}

          {settingsView === "favorites" && (
            <section className={styles.settingsForm}>
              <h3>Избранные задания</h3>
              {favoriteJobs.length === 0 && <p className="muted-text">Вы пока ничего не добавили в избранное.</p>}
              {favoriteJobs.map((job) => (
                <article key={job.id} className={styles.favoriteItem}>
                  <Link to={`/jobs/${job.id}`}>
                    <strong>{job.title}</strong>
                  </Link>
                  <p className="muted-text">{job.category || "Без категории"}</p>
                </article>
              ))}
            </section>
          )}

          {settingsView === "notifications" && (
            <div className={styles.settingsNarrowWrap}>
              <section className={`${styles.settingsForm} ${styles.settingsFormNarrow}`}>
                <h3>Уведомления</h3>
                {renderBanner(BANNER.settingsNotif)}
                <p className={styles.settingsFieldHint}>
                  Напоминания только в интерфейсе сайта. Настройки хранятся в браузере на этом устройстве.
                </p>
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
                  <span className={styles.checkText}>Напоминания в шапке сайта</span>
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
                <button className="primary-button" type="button" onClick={saveNotifications}>
                  Сохранить настройки
                </button>
              </section>
            </div>
          )}

          {settingsView === "delete" && (
            <section className={styles.settingsForm}>
              <h3>Удаление профиля</h3>
              {renderBanner(BANNER.settingsDelete)}
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

  return (
    <div className={`page ${styles.root}`}>
      <div className={`card ${styles.profileCard}`}>
        <div className={styles.profileHeader}>
          <div className={styles.avatarWrap}>
            {user.profile?.avatar ? (
              <img src={user.profile.avatar} alt="" className={styles.avatarImg} />
            ) : (
              <div className={styles.avatar}>{user.username?.[0]?.toUpperCase() || "U"}</div>
            )}
          </div>
          <div className={styles.profileMeta}>
            <h2 className={styles.profileNameRow}>
              <span>{user.username}</span>
              {user.profile?.is_verified ? (
                <span className={styles.profileVerifiedBadge} title="Верифицированный профиль">
                  <FaCertificate aria-hidden />
                </span>
              ) : null}
            </h2>
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
          <button type="button" className={activeTab === "saved" ? styles.activeTab : ""} onClick={() => setParams({ tab: "saved" })}>Сохранённые поиски</button>
          <button type="button" className={activeTab === "reviews" ? styles.activeTab : ""} onClick={() => setParams({ tab: "reviews" })}>Отзывы</button>
          <button type="button" className={activeTab === "info" ? styles.activeTab : ""} onClick={() => setParams({ tab: "info" })}>Информация</button>
          <button type="button" className={activeTab === "settings" ? styles.activeTab : ""} onClick={() => setParams({ tab: "settings" })}>Настройки</button>
          {user.role === "worker" ? (
            <button
              type="button"
              className={activeTab === "promo" ? styles.activeTab : ""}
              onClick={() => setParams({ tab: "promo" })}
            >
              Карточка на главной
            </button>
          ) : null}
        </div>

        {renderContent()}
      </div>
    </div>
  );
};

export default Profile;

