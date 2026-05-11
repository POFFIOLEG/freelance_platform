import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Login.module.css";

const Login = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [status, setStatus] = useState({ type: null, message: "" });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ type: null, message: "" });
    setLoading(true);
    try {
      await login(form);
      navigate("/profile?tab=jobs");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  };

  const onChange = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  return (
    <div className={`page auth-page ${styles.root}`}>
      <div className="card auth-card">
        <h2>Войти на платформу</h2>
        <p className="muted-text">Используйте имя пользователя и пароль.</p>
        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="input-group">
            <label>Имя пользователя</label>
            <input
              value={form.username}
              onChange={onChange("username")}
              placeholder="username"
              required
            />
          </div>
          <div className="input-group">
            <label>Пароль</label>
            <input
              type="password"
              value={form.password}
              onChange={onChange("password")}
              required
            />
          </div>
          {status.message && (
            <p className={status.type === "error" ? "error-text" : "success-text"}>{status.message}</p>
          )}
          <button className="primary-button" disabled={loading}>
            {loading ? "Входим..." : "Войти"}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;