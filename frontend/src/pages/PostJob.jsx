import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { jobApi } from "../api/client.js";
import styles from "./PostJob.module.css";

const initialState = {
  title: "",
  description: "",
  category: "",
  location: "",
  budget_min: "",
  budget_max: "",
  deadline: "",
  skills_required: "",
  attachments: "",
};

const PostJob = () => {
  const { user, token } = useAuth();
  const [form, setForm] = useState(initialState);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);

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
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus({ type: null, message: "" });
    try {
      await jobApi.create(
        {
          ...form,
          budget_min: form.budget_min ? Number(form.budget_min) : 0,
          budget_max: form.budget_max ? Number(form.budget_max) : 0,
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

  return (
    <div className={`page ${styles.root}`}>
      <div className="card post-job-card">
        <h2>Опубликовать задание</h2>
        <p className="muted-text">Опишите задачу, бюджет и ожидаемый результат.</p>
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
              <input
                value={form.category}
                onChange={(event) => setField("category", event.target.value)}
                placeholder="Дизайн, Разработка..."
              />
            </div>
            <div className="input-group">
              <label>Локация</label>
              <input
                value={form.location}
                onChange={(event) => setField("location", event.target.value)}
                placeholder="Москва / удаленно"
              />
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
              />
            </div>
            <div className="input-group">
              <label>Бюджет до</label>
              <input
                type="number"
                value={form.budget_max}
                onChange={(event) => setField("budget_max", event.target.value)}
                min={0}
              />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Срок сдачи</label>
              <input
                type="date"
                value={form.deadline}
                onChange={(event) => setField("deadline", event.target.value)}
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
            />
          </div>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Публикуем..." : "Опубликовать"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default PostJob;
