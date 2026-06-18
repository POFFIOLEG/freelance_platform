import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { hubApi, jobApi } from "../api/client.js";
import styles from "./PostJob.module.css";
import { CATEGORIES } from "../constants/categories.js";
import { COUNTRIES, getCitiesByCountry } from "../constants/geo.js";

const SKILLS_SUGGESTIONS = [
  "React",
  "TypeScript",
  "Django",
  "Python",
  "UI/UX",
  "Figma",
  "PostgreSQL",
  "Node.js",
];

const initialState = {
  title: "",
  description: "",
  category: "",
  subcategory: "",
  country: "Россия",
  city: "",
  budget_min: "",
  budget_max: "",
  deadline: "",
  skills_required: "",
  attachments: "",
  is_urgent: false,
  is_contest: false,
  is_exchange: false,
};

function todayLocalIsoDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const PostJob = () => {
  const { user, token } = useAuth();
  const [form, setForm] = useState(initialState);
  const [selectedType, setSelectedType] = useState("");
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState([]);

  useEffect(() => {
    if (!token || user?.role !== "employer") {
      setTemplates([]);
      return;
    }
    hubApi
      .templatesList(token)
      .then((list) => setTemplates(Array.isArray(list) ? list : []))
      .catch(() => setTemplates([]));
  }, [token, user?.role]);

  if (!user) {
    return (
      <div className={`page ${styles.root}`}>
        <div className="card">
          <h2>Размещение задания</h2>
          <p>Авторизуйтесь как работодатель, чтобы публиковать задания.</p>
        </div>
      </div>
    );
  }

  if (user.role !== "employer") {
    return (
      <div className={`page ${styles.root}`}>
        <div className="card">
          <h2>Доступ ограничен</h2>
          <p>Только работодатели могут создавать задания.</p>
        </div>
      </div>
    );
  }

  const setField = (field, value) => {
    setForm((prev) => {
      if (field === "category") {
        return { ...prev, category: value, subcategory: "" };
      }
      if (field === "country") {
        return { ...prev, country: value, city: "" };
      }
      return { ...prev, [field]: value };
    });
  };

  const selectType = (type) => {
    setSelectedType(type);
    setForm((prev) => ({
      ...prev,
      is_exchange: type === "exchange",
      is_contest: type === "contest",
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: "" });

    const title = (form.title || "").trim();
    const description = (form.description || "").trim();
    if (!title || !description) {
      setStatus({ type: "error", message: "Заполните название и описание." });
      setLoading(false);
      return;
    }
    if (!form.category?.trim() || !form.subcategory?.trim()) {
      setStatus({ type: "error", message: "Выберите категорию и подкатегорию." });
      setLoading(false);
      return;
    }
    if (!form.deadline) {
      setStatus({ type: "error", message: "Укажите срок сдачи." });
      setLoading(false);
      return;
    }
    const deadlineMin = todayLocalIsoDate();
    if (form.deadline < deadlineMin) {
      setStatus({ type: "error", message: "Срок сдачи не может быть в прошлом." });
      setLoading(false);
      return;
    }

    const bmin = form.budget_min === "" ? null : Number(form.budget_min);
    const bmax = form.budget_max === "" ? null : Number(form.budget_max);
    if (bmin === null || bmax === null || Number.isNaN(bmin) || Number.isNaN(bmax)) {
      setStatus({ type: "error", message: "Укажите бюджет от и до." });
      setLoading(false);
      return;
    }
    if (bmin < 0 || bmax < 0) {
      setStatus({ type: "error", message: "Бюджет не может быть отрицательным." });
      setLoading(false);
      return;
    }
    if (bmin > bmax && bmax > 0) {
      setStatus({ type: "error", message: "Нижняя граница бюджета не может быть больше верхней." });
      setLoading(false);
      return;
    }
    try {
      await jobApi.create(
        {
          ...form,
          title,
          description,
          deadline: form.deadline ? form.deadline : null,
          attachments: (form.attachments || "").trim(),
          budget_min: bmin,
          budget_max: bmax,
          skills_required: form.skills_required
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
        },
        token,
      );
      setForm(initialState);
      setStatus({ type: "success", message: "Задание опубликовано" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const countryCities = getCitiesByCountry(form.country);

  return (
    <div className={`page ${styles.root}`}>
      <div className="card post-job-card">
        {!selectedType ? (
          <>
            <h2>Выберите тип задачи</h2>
            <div className={styles.typeGrid}>
              <button className={styles.typeCard} type="button" onClick={() => selectType("order")}>
                <h3>Заказ</h3>
                <p>Разовая задача или краткосрочный проект</p>
                <span className="primary-button">Опубликовать заказ</span>
              </button>
              <button className={styles.typeCard} type="button" onClick={() => selectType("exchange")}>
                <h3>Биржа</h3>
                <p>Исполнители размещают ставки, вы выбираете лучшее предложение</p>
                <span className="primary-button">Разместить на бирже</span>
              </button>
              <button className={styles.typeCard} type="button" onClick={() => selectType("contest")}>
                <h3>Розыгрыш</h3>
                <p>Случайный выбор исполнителя из откликнувшихся кандидатов</p>
                <span className="primary-button">Создать розыгрыш</span>
              </button>
            </div>
          </>
        ) : (
          <>
            <h2>Опубликовать задание</h2>
            <p className="muted-text">Опишите задачу, бюджет и ожидаемый результат.</p>
            {templates.length > 0 && (
              <label className={styles.templateRow}>
                <span>Шаблон ТЗ</span>
                <select
                  className={styles.templateSelect}
                  defaultValue=""
                  onChange={(e) => {
                    const t = templates.find((x) => String(x.id) === e.target.value);
                    if (!t) return;
                    setForm((prev) => ({
                      ...prev,
                      title: t.title || prev.title,
                      description: t.body || prev.description,
                      category: t.category || prev.category,
                    }));
                  }}
                >
                  <option value="">— не выбран —</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <button
              type="button"
              className="secondary-button"
              onClick={async () => {
                const name = window.prompt("Название шаблона");
                if (!name?.trim()) return;
                try {
                  await hubApi.templateCreate(
                    {
                      name: name.trim(),
                      title: form.title,
                      body: form.description,
                      category: form.category,
                    },
                    token,
                  );
                  const list = await hubApi.templatesList(token);
                  setTemplates(Array.isArray(list) ? list : []);
                  setStatus({ type: "success", message: "Шаблон сохранён" });
                } catch (err) {
                  setStatus({ type: "error", message: err.message });
                }
              }}
            >
              Сохранить текущее ТЗ как шаблон
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setSelectedType("");
                setForm(initialState);
              }}
            >
              Назад к выбору типа
            </button>
          </>
        )}

        {selectedType && (
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Название</label>
            <input
              value={form.title}
              onChange={(event) => setField("title", event.target.value)}
              required
            />
          </div>
          <div className="input-group">
            <label>Описание</label>
            <textarea
              rows={4}
              value={form.description}
              onChange={(event) => setField("description", event.target.value)}
              required
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Категория</label>
              <select
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                required
              >
                <option value="">Выберите категорию</option>
                {Object.keys(CATEGORIES).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Подкатегория</label>
              <select
                value={form.subcategory}
                onChange={(event) => setField("subcategory", event.target.value)}
                disabled={!form.category}
                required
              >
                <option value="">Выберите подкатегорию</option>
                {(CATEGORIES[form.category] || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Страна</label>
              <select value={form.country} onChange={(event) => setField("country", event.target.value)}>
                {COUNTRIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label>Город</label>
              <select value={form.city} onChange={(event) => setField("city", event.target.value)}>
                <option value="">Выберите город</option>
                {countryCities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Бюджет от</label>
              <input
                type="number"
                value={form.budget_min}
                onChange={(event) => setField("budget_min", event.target.value)}
                min={0}
                required
              />
            </div>
            <div className="input-group">
              <label>Бюджет до</label>
              <input
                type="number"
                value={form.budget_max}
                onChange={(event) => setField("budget_max", event.target.value)}
                min={0}
                required
              />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Срок сдачи</label>
              <input
                type="date"
                min={todayLocalIsoDate()}
                value={form.deadline}
                onChange={(event) => setField("deadline", event.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label>Ссылка на материалы</label>
              <input
                value={form.attachments}
                onChange={(event) => setField("attachments", event.target.value)}
                placeholder="https://..."
              />
            </div>
          </div>
          <div className="input-group">
            <label>Навыки (через запятую)</label>
            <input
              value={form.skills_required}
              onChange={(event) => setField("skills_required", event.target.value)}
              placeholder="React, UX, Python"
              list="skills-suggestions"
            />
            <datalist id="skills-suggestions">
              {SKILLS_SUGGESTIONS.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>
          <label className={styles.urgentRow}>
            <input
              type="checkbox"
              className={styles.urgentInput}
              checked={form.is_urgent}
              onChange={(event) => setField("is_urgent", event.target.checked)}
            />
            <span className={styles.urgentSwitch} aria-hidden="true" />
            <span className={styles.urgentLabel}>Только срочный заказ</span>
          </label>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Публикуем..." : "Опубликовать"}
          </button>
        </form>
        )}
      </div>
    </div>
  );
};

export default PostJob;
