import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Register.module.css";

const initialForm = {
  username: "",
  email: "",
  password: "",
  role: "worker",
  first_name: "",
  last_name: "",
  profile: {
    headline: "",
    skills: "",
  },
};

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);

  const setField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const setProfileField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: null, message: "" });
    setLoading(true);
    try {
      await register({
        ...form,
        profile: {
          ...form.profile,
          skills: form.profile.skills
            .split(",")
            .map((skill) => skill.trim())
            .filter(Boolean),
        },
      });
      navigate("/profile");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`page auth-page ${styles.root}`}>
      <div className="card auth-card">
        <h2>Регистрация</h2>
        <p className="muted-text">Создайте аккаунт работодателя или исполнителя.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Имя пользователя</label>
            <input
              value={form.username}
              onChange={(event) => setField("username", event.target.value)}
              required
              placeholder="username"
            />
          </div>
          <div className="input-group">
            <label>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setField("email", event.target.value)}
              required
              placeholder="user@mail.com"
            />
          </div>
          <div className="input-row">
            <div className="input-group">
              <label>Имя</label>
              <input
                value={form.first_name}
                onChange={(event) => setField("first_name", event.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Фамилия</label>
              <input
                value={form.last_name}
                onChange={(event) => setField("last_name", event.target.value)}
              />
            </div>
          </div>
          <div className="input-group">
            <label>Пароль</label>
            <input
              type="password"
              value={form.password}
              onChange={(event) => setField("password", event.target.value)}
              required
            />
            <p className="muted-text" style={{ marginTop: "0.35rem", fontSize: "0.9rem" }}>
              Не короче 8 символов, не только цифры, нужна хотя бы одна буква, без типовых паролей вроде
              «password» / «qwerty».
            </p>
          </div>
          <div className="input-group">
            <label>Роль</label>
            <select value={form.role} onChange={(event) => setField("role", event.target.value)}>
              <option value="worker">Исполнитель</option>
              <option value="employer">Работодатель</option>
            </select>
          </div>
          <div className="input-group">
            <label>Заголовок профиля</label>
            <input
              value={form.profile.headline}
              onChange={(event) => setProfileField("headline", event.target.value)}
              placeholder="Например, Проджект-менеджер"
            />
          </div>
          <div className="input-group">
            <label>Навыки (через запятую)</label>
            <input
              value={form.profile.skills}
              onChange={(event) => setProfileField("skills", event.target.value)}
              placeholder="Product, React, HR"
            />
          </div>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Регистрируем..." : "Создать аккаунт"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Register;

