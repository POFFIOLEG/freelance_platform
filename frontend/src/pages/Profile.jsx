import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
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
  const { user, token, updateProfile, refreshProfile } = useAuth();
  const [form, setForm] = useState(defaultProfile);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user?.profile) {
      setForm({
        ...defaultProfile,
        ...user.profile,
        skills: Array.isArray(user.profile.skills)
          ? user.profile.skills.join(", ")
          : user.profile.skills || "",
      });
    } else if (token) {
      refreshProfile().then((profile) => {
        if (profile) {
          setForm({
            ...defaultProfile,
            ...profile,
            skills: Array.isArray(profile.skills) ? profile.skills.join(", ") : profile.skills,
          });
        }
      });
    }
  }, [user, token, refreshProfile]);

  const setField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setStatus({ type: "error", message: "Авторизуйтесь, чтобы обновить профиль" });
      return;
    }
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
      setStatus({ type: "success", message: "Профиль обновлен" });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
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
      <div className="card auth-card">
        <h2>Профиль {user.username}</h2>
        <p className="muted-text">
          {user.role === "employer" ? "Работодатель" : "Исполнитель"} • {user.email}
        </p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Заголовок</label>
            <input
              value={form.headline}
              onChange={(event) => setField("headline", event.target.value)}
              placeholder="UX дизайнер, фронтенд-разработчик..."
            />
          </div>
          <div className="input-group">
            <label>Описание</label>
            <textarea
              value={form.bio}
              onChange={(event) => setField("bio", event.target.value)}
              rows={4}
              placeholder="Расскажите о себе и опыте"
            />
          </div>
          <div className="input-group">
            <label>Навыки (через запятую)</label>
            <input
              value={form.skills}
              onChange={(event) => setField("skills", event.target.value)}
              placeholder="React, Django, UI/UX"
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Опыт (лет)</label>
              <input
                type="number"
                value={form.experience_years}
                onChange={(event) => setField("experience_years", event.target.value)}
                min={0}
              />
            </div>
            <div className="input-group">
              <label>Ставка (₽/ч)</label>
              <input
                type="number"
                value={form.hourly_rate || ""}
                onChange={(event) => setField("hourly_rate", event.target.value)}
                min={0}
              />
            </div>
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Компания</label>
              <input
                value={form.company}
                onChange={(event) => setField("company", event.target.value)}
                placeholder="Компания или команда"
              />
            </div>
            <div className="input-group">
              <label>Локация</label>
              <input
                value={form.location}
                onChange={(event) => setField("location", event.target.value)}
                placeholder="Москва, удаленно"
              />
            </div>
          </div>
          <div className="input-group">
            <label>Доступность</label>
            <input
              value={form.availability}
              onChange={(event) => setField("availability", event.target.value)}
              placeholder="Полная занятость, 20 ч/нед"
            />
          </div>
          <div className="input-group">
            <label>Портфолио</label>
            <input
              value={form.portfolio_url}
              onChange={(event) => setField("portfolio_url", event.target.value)}
              placeholder="https://..."
            />
          </div>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Сохраняем..." : "Сохранить"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Profile;

