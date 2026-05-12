import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { hubApi, jobApi } from "../api/client.js";
import styles from "./JobList.module.css";
import { useAuth } from "../context/AuthContext.jsx";
import { CATEGORY_BY_ID, CATEGORY_TREE, SUBCATEGORY_BY_ID } from "../constants/categoriesTree.js";
import CategoryTreeFilter from "../components/CategoryTreeFilter.jsx";
import CountryCityListFilter from "../components/CountryCityListFilter.jsx";
import JobListCard from "../components/JobListCard.jsx";
import { broadcastFavoritesChanged } from "../constants/favoritesSync.js";
import { JOB_LIST_TYPE_TABS } from "../utils/jobListUi.js";

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
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saveNameDraft, setSaveNameDraft] = useState("");

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

  const toggleFavorite = async (jobId) => {
    const removing = favorites.includes(jobId);
    const next = removing ? favorites.filter((id) => id !== jobId) : [...favorites, jobId];
    setFavorites(next);
    localStorage.setItem(favoritesKey, JSON.stringify(next));
    broadcastFavoritesChanged(favoritesKey);
    if (token && user) {
      try {
        if (removing) {
          const list = await hubApi.favoritesList(token);
          const row = (list || []).find((x) => Number(x.job?.id) === Number(jobId));
          if (row) await hubApi.favoriteDelete(row.id, token);
        } else {
          await hubApi.favoriteAdd(jobId, token);
        }
      } catch {
        /* офлайн / дубль — локальный список уже обновлён */
      }
    }
  };

  return (
    <div className={`page job-page ${styles.root}`}>
      <div className={styles.layout}>
        <section className={`card ${styles.listColumn}`}>
          <h2 className={styles.pageTitle}>Вся удаленная работа</h2>
          <div className={styles.typeTabs}>
            {JOB_LIST_TYPE_TABS.map(({ id, label }) => (
              <button
                key={id}
                className={`secondary-button ${filters.type === id ? styles.activeTab : ""}`}
                type="button"
                onClick={() => switchType(id)}
              >
                {label}
              </button>
            ))}
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
            {jobs.map((job) => (
              <JobListCard
                key={job.id}
                job={job}
                user={user}
                favorites={favorites}
                styles={styles}
                onToggleFavorite={toggleFavorite}
                onOpen={(id) => navigate(`/jobs/${id}`)}
              />
            ))}
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

            <div className={styles.filterOptionsBlock}>
              <div className={styles.filterOptionsTitle}>Дополнительные условия</div>
              <label className={styles.filterToggleRow}>
                <input
                  type="checkbox"
                  className={styles.filterToggleInput}
                  checked={filters.urgent}
                  onChange={(event) => updateFilter("urgent", event.target.checked)}
                />
                <span className={styles.filterToggleSwitch} aria-hidden />
                <span className={styles.filterToggleText}>Только срочные</span>
              </label>
              <label className={styles.filterToggleRow}>
                <input
                  type="checkbox"
                  className={styles.filterToggleInput}
                  checked={filters.without_assignee}
                  onChange={(event) => updateFilter("without_assignee", event.target.checked)}
                />
                <span className={styles.filterToggleSwitch} aria-hidden />
                <span className={styles.filterToggleText}>Заказы без исполнителя</span>
              </label>
            </div>

            <button className="primary-button" type="submit" disabled={loading}>
              Найти
            </button>
            {token ? (
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSaveNameDraft("");
                  setSaveModalOpen(true);
                }}
              >
                Сохранить поиск
              </button>
            ) : null}
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

      {saveModalOpen ? (
        <div
          className={styles.saveOverlay}
          role="presentation"
          onClick={() => setSaveModalOpen(false)}
        >
          <div
            className={`card ${styles.saveModal}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-search-title"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="save-search-title" className={styles.saveModalTitle}>
              Сохранить поиск
            </h3>
            <p className="muted-text">
              Укажите название — поиск появится в профиле в разделе «Сохранённые поиски».
            </p>
            <label className={styles.saveModalLabel}>
              Название
              <input
                autoFocus
                value={saveNameDraft}
                onChange={(e) => setSaveNameDraft(e.target.value)}
                placeholder="Например: удалённый копирайтинг"
              />
            </label>
            <div className={styles.saveModalActions}>
              <button type="button" className="secondary-button" onClick={() => setSaveModalOpen(false)}>
                Отмена
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={async () => {
                  const name = saveNameDraft.trim();
                  if (!name) {
                    setStatus({ type: "error", message: "Введите название сохранённого поиска." });
                    return;
                  }
                  try {
                    await hubApi.savedSearchCreate({ name, query: { ...appliedFilters } }, token);
                    setSaveModalOpen(false);
                    setSaveNameDraft("");
                    setStatus({
                      type: "success",
                      message: "Поиск сохранён. Откройте профиль → «Сохранённые поиски».",
                    });
                  } catch (e) {
                    setStatus({ type: "error", message: e.message });
                  }
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default JobList;
