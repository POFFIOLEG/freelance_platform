import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { jobApi } from "../api/client.js";
import styles from "./JobList.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { CATEGORY_BY_ID, CATEGORY_TREE, SUBCATEGORY_BY_ID } from "../constants/categoriesTree.js";
import CategoryTreeFilter from "../components/CategoryTreeFilter.jsx";
import CountryCityListFilter from "../components/CountryCityListFilter.jsx";
import { broadcastFavoritesChanged } from "../constants/favoritesSync.js";
import { getJobCardStatus } from "../utils/jobStatusUi.js";

const initialFilters = {
  q: "",
  categoryIds: [],
  subcategoryIds: [],
  country: "all",
  city: "all",
  budget_from: "",
  budget_to: "",
  urgent: false,
  without_assignee: false,
  type: "order",
};

const JobList = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, token } = useAuth();
  const [filters, setFilters] = useState({ ...initialFilters });
  const [appliedFilters, setAppliedFilters] = useState({ ...initialFilters });
  const [jobs, setJobs] = useState([]);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);

  const favoritesKey = `favorite_jobs_${user?.id || "guest"}`;

  const fetchJobs = async () => {
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      const categories = appliedFilters.categoryIds
        .map((id) => CATEGORY_BY_ID[id]?.title)
        .filter(Boolean);
      const subcategories = appliedFilters.subcategoryIds
        .map((id) => SUBCATEGORY_BY_ID[id]?.title)
        .filter(Boolean);
      const payload = {
        ...appliedFilters,
        categories,
        subcategories,
      };
      delete payload.categoryIds;
      delete payload.subcategoryIds;
      const fromNum = String(payload.budget_from || "").trim();
      const toNum = String(payload.budget_to || "").trim();
      if (fromNum === "" || Number.isNaN(Number(fromNum)) || Number(fromNum) < 0) {
        delete payload.budget_from;
      }
      if (toNum === "" || Number.isNaN(Number(toNum)) || Number(toNum) < 0) {
        delete payload.budget_to;
      }
      const data = await jobApi.list(payload, token);
      setJobs(data);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobs();
  }, [appliedFilters, token]);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(favoritesKey) || "[]");
      setFavorites(Array.isArray(saved) ? saved : []);
    } catch {
      setFavorites([]);
    }
  }, [favoritesKey]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const next = {
      q: params.get("q") || "",
      categoryIds: (params.get("categoryIds") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      subcategoryIds: (params.get("subcategoryIds") || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
      country: params.get("country") || "all",
      city: params.get("city") || "all",
      budget_from: params.get("budget_from") || "",
      budget_to: params.get("budget_to") || "",
      urgent: params.get("urgent") === "1",
      without_assignee: params.get("without_assignee") === "1",
      type: params.get("type") || "order",
    };
    setFilters(next);
    setAppliedFilters(next);
  }, [location.search]);

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    setAppliedFilters({ ...filters });
  };

  const updateFilter = (field, value) => {
    setFilters((prev) => {
      if (field === "country") {
        return { ...prev, country: value, city: "all" };
      }
      return { ...prev, [field]: value };
    });
  };

  const switchType = (type) => {
    setFilters((prev) => ({ ...prev, type }));
    setAppliedFilters((prev) => ({ ...prev, type }));
  };

  const toggleFavorite = (jobId) => {
    const next = favorites.includes(jobId)
      ? favorites.filter((id) => id !== jobId)
      : [...favorites, jobId];
    setFavorites(next);
    localStorage.setItem(favoritesKey, JSON.stringify(next));
    broadcastFavoritesChanged(favoritesKey);
  };

  return (
    <div className={`page job-page ${styles.root}`}>
      <div className={styles.layout}>
        <section className={`card ${styles.listColumn}`}>
          <h2 className={styles.pageTitle}>Вся удаленная работа</h2>
          <div className={styles.typeTabs}>
            <button
              className={`secondary-button ${filters.type === "order" ? styles.activeTab : ""}`}
              type="button"
              onClick={() => switchType("order")}
            >
              Заказы
            </button>
            <button
              className={`secondary-button ${filters.type === "exchange" ? styles.activeTab : ""}`}
              type="button"
              onClick={() => switchType("exchange")}
            >
              Биржа
            </button>
            <button
              className={`secondary-button ${filters.type === "contest" ? styles.activeTab : ""}`}
              type="button"
              onClick={() => switchType("contest")}
            >
              Розыгрыши
            </button>
          </div>
          <div className="card-header">
            <h3>Найдено заданий: {jobs.length}</h3>
            <button className="secondary-button" onClick={fetchJobs}>
              Обновить
            </button>
          </div>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          {loading && <p>Загружаем...</p>}
          {!loading && jobs.length === 0 && <p className="muted-text">Заданий не найдено.</p>}
          <div className={styles.jobsList}>
            {jobs.map((job) => {
              const cardStatus = getJobCardStatus(job.status);
              const workerResponded =
                user?.role === "worker" && Boolean(job.my_application_status);
              const workerApplicationsClosed =
                user?.role === "worker" &&
                (job.status !== "open" || Boolean(job.assigned_to));
              const primaryCta = job.is_exchange
                ? "Сделать ставку"
                : job.is_contest
                  ? "Принять участие"
                  : "Откликнуться";
              const primaryLabel = workerApplicationsClosed
                ? job.assigned_to
                  ? "Исполнитель выбран"
                  : "Набор закрыт"
                : workerResponded
                  ? "Откликнулись"
                  : primaryCta;
              return (
                <article key={job.id} className={styles.jobRow}>
                  <div className={styles.jobMain}>
                    <h4>{job.title}</h4>
                    <p className="muted-text">{job.category || "Без категории"}</p>
                    <p className={styles.jobSnippet}>{job.description}</p>
                    <div className={styles.jobMeta}>
                      <span><strong>Бюджет:</strong> {Number(job.budget_min || 0).toLocaleString("ru-RU")} - {Number(job.budget_max || 0).toLocaleString("ru-RU")} ₽</span>
                      <span><strong>Локация:</strong> {job.city || job.location || "Любая"}</span>
                      <span><strong>Отклики:</strong> {job.applications_count || 0}</span>
                    </div>
                  </div>
                  <div className={styles.jobActions}>
                    <span
                      className={`status-pill ${styles.statusPill} ${styles[`statusGroup_${cardStatus.group}`]}`}
                    >
                      {cardStatus.label}
                    </span>
                    <button
                      className={`secondary-button ${styles.actionButton}`}
                      type="button"
                      onClick={() => toggleFavorite(job.id)}
                    >
                      {favorites.includes(job.id) ? "В избранном" : "В избранное"}
                    </button>
                    <button
                      className={`${workerApplicationsClosed ? "secondary-button" : "primary-button"} ${
                        styles.actionButton
                      } ${workerResponded && !workerApplicationsClosed ? styles.actionButtonApplied : ""} ${
                        workerApplicationsClosed ? styles.actionButtonClosed : ""
                      }`}
                      type="button"
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    >
                      {primaryLabel}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <aside className={`card ${styles.filterColumn}`}>
          <h3>Фильтры</h3>
          <form className={styles.filterForm} onSubmit={handleFilterSubmit}>
            <CategoryTreeFilter
              tree={CATEGORY_TREE}
              value={{ categoryIds: filters.categoryIds, subcategoryIds: filters.subcategoryIds }}
              onChange={(next) => {
                setFilters((prev) => ({
                  ...prev,
                  categoryIds: next.categoryIds,
                  subcategoryIds: next.subcategoryIds,
                }));
              }}
            />

            <CountryCityListFilter
              country={filters.country}
              city={filters.city}
              onCountryChange={(v) => updateFilter("country", v)}
              onCityChange={(v) => updateFilter("city", v)}
            />

            <span className={styles.fieldLabel}>Бюджет, ₽</span>
            <div className={styles.budgetRow}>
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="От"
                value={filters.budget_from}
                onChange={(event) => updateFilter("budget_from", event.target.value)}
              />
              <input
                type="number"
                min={0}
                step={1}
                inputMode="numeric"
                placeholder="До"
                value={filters.budget_to}
                onChange={(event) => updateFilter("budget_to", event.target.value)}
              />
            </div>

            <label className={styles.fieldLabel}>Ключевые слова</label>
            <input
              placeholder="Укажите через запятую"
              value={filters.q}
              onChange={(event) => updateFilter("q", event.target.value)}
            />

            <label className={styles.fieldLabel}>Дополнительные условия</label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={filters.urgent}
                onChange={(event) => updateFilter("urgent", event.target.checked)}
              />
              Только срочные
            </label>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                checked={filters.without_assignee}
                onChange={(event) => updateFilter("without_assignee", event.target.checked)}
              />
              Заказы без исполнителя
            </label>

            <button className="primary-button" type="submit" disabled={loading}>
              Найти
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setFilters({ ...initialFilters, type: filters.type });
                setAppliedFilters({ ...initialFilters, type: filters.type });
              }}
            >
              Сбросить фильтры
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
};

export default JobList;
