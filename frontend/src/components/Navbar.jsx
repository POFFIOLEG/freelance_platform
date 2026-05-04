import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FaBars,
  FaBell,
  FaBriefcase,
  FaComments,
  FaHome,
  FaMoon,
  FaSun,
  FaTimes,
  FaUser,
} from "react-icons/fa";
import { useAuth } from "../context/AuthContext.jsx";
import styles from "./Navbar.module.css";
import logoLight from "../../img/Logo_white.png";
import logoDark from "../../img/Logo_black.png";
import { jobApi } from "../api/client.js";

const Navbar = () => {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");
  const { user, token, logout, switchRole } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const profileDropdownRef = useRef(null);
  const notificationsDropdownRef = useRef(null);

  const close = () => {
    setOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  };
  const isDark = theme === "dark";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const handleRoleSwitch = async (event) => {
    const role = event.target.value;
    try {
      await switchRole(role);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    let isUnmounted = false;
    const loadNotifications = async () => {
      try {
        const dashboard = await jobApi.dashboard(token);
        if (isUnmounted) return;
        const next = [];
        if (user.role === "employer") {
          const submitted = (dashboard.owned || []).filter((job) => job.status === "submitted").length;
          const newApplications = (dashboard.owned || []).reduce(
            (sum, job) => sum + Number(job.applications_count || 0),
            0,
          );
          if (submitted > 0) {
            next.push({
              title: "Проверка результата",
              detail: `Ожидают проверки: ${submitted}`,
              route: "/dashboard",
            });
          }
          if (newApplications > 0) {
            next.push({
              title: "Отклики",
              detail: `Новых откликов: ${newApplications}`,
              route: "/dashboard",
            });
          }
        } else {
          const assigned = (dashboard.assigned || []).length;
          const waiting = (dashboard.assigned || []).filter((job) => job.status === "in_progress").length;
          if (assigned > 0) {
            next.push({
              title: "Назначенные задачи",
              detail: `Всего: ${assigned}`,
              route: "/dashboard",
            });
          }
          if (waiting > 0) {
            next.push({
              title: "В работе",
              detail: `Активных: ${waiting}`,
              route: "/chat",
            });
          }
        }
        setNotifications(next);
      } catch (error) {
        console.error(error);
      }
    };

    loadNotifications();
    const interval = setInterval(loadNotifications, 8000);
    return () => {
      isUnmounted = true;
      clearInterval(interval);
    };
  }, [user, token]);

  useEffect(() => {
    const onMouseDown = (event) => {
      if (
        profileDropdownRef.current &&
        !profileDropdownRef.current.contains(event.target) &&
        notificationsDropdownRef.current &&
        !notificationsDropdownRef.current.contains(event.target)
      ) {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setProfileOpen(false);
        setNotificationsOpen(false);
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return (
    <header className={styles.header}>
      <div className={styles.headerContainer}>
        <img src={isDark ? logoDark : logoLight} className={styles.logo} alt="Логотип" />
        <nav className={`${styles.nav} ${open ? styles.mobileMenu : ""}`}>
          <Link to="/" onClick={close} className={styles.navLink}>
            <FaHome />
            Главная
          </Link>
          {(!user || user.role === "worker") && (
            <Link to="/jobs" onClick={close} className={styles.navLink}>
              <FaBriefcase />
              Задания
            </Link>
          )}
          {(!user || user.role === "employer") && (
            <Link to="/post-job" onClick={close} className={styles.navLink}>
              <FaBriefcase />
              Разместить
            </Link>
          )}
          <Link to="/chat" onClick={close} className={styles.navLink}>
            <FaComments />
            Чат
          </Link>
          <Link to="/reviews" onClick={close} className={styles.navLink}>
            <FaUser />
            Отзывы
          </Link>
          <Link to="/about" onClick={close} className={styles.navLink}>
            О нас
          </Link>
          <Link to="/contests" onClick={close} className={styles.navLink}>
            Розыгрыши
          </Link>
          <Link to="/exchange" onClick={close} className={styles.navLink}>
            Биржа
          </Link>
          {user ? (
            <div className={styles.navAuth}>
              <div className={styles.dropdownWrap} ref={notificationsDropdownRef}>
                <button
                  className={styles.notificationButton}
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((prev) => !prev);
                    setProfileOpen(false);
                  }}
                >
                  <FaBell />
                  {notifications.length > 0 && <span className={styles.unreadDot}>{notifications.length}</span>}
                </button>
                {notificationsOpen && (
                  <div className={styles.dropdownMenu}>
                    <h4>Уведомления</h4>
                    {notifications.length === 0 && <p className="muted-text">Новых уведомлений нет</p>}
                    {notifications.map((item, index) => (
                      <button
                        key={`${item.title}-${index}`}
                        className={styles.notificationItem}
                        onClick={() => {
                          navigate(item.route || "/dashboard");
                          close();
                        }}
                        type="button"
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.dropdownWrap} ref={profileDropdownRef}>
                <button
                  className={styles.profileButton}
                  type="button"
                  onClick={() => {
                    setProfileOpen((prev) => !prev);
                    setNotificationsOpen(false);
                  }}
                >
                  <FaUser />
                  {user.username}
                </button>
                {profileOpen && (
                  <div className={styles.dropdownMenu}>
                    <Link to="/dashboard" onClick={close} className={styles.dropdownLink}>
                      Кабинет
                    </Link>
                    <button
                      className={styles.dropdownButton}
                      onClick={() => {
                        navigate("/dashboard?view=jobs");
                        close();
                      }}
                      type="button"
                    >
                      Мои задания
                    </button>
                    <button
                      className={styles.dropdownButton}
                      onClick={() => {
                        navigate("/dashboard?view=applications");
                        close();
                      }}
                      type="button"
                    >
                      Отклики
                    </button>
                    <label className={styles.dropdownField}>
                      <span>Роль</span>
                      <select value={user.role} onChange={handleRoleSwitch} className={styles.roleSelect}>
                        <option value="worker">Исполнитель</option>
                        <option value="employer">Работодатель</option>
                      </select>
                    </label>
                    <button className={styles.dropdownButton} onClick={toggleTheme} type="button">
                      {isDark ? <FaSun /> : <FaMoon />}
                      {isDark ? "Светлая тема" : "Темная тема"}
                    </button>
                    <button className={styles.dropdownButton} onClick={logout} type="button">
                      Выйти
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className={styles.navAuth}>
              <Link to="/login" onClick={close} className={styles.navLink}>
                Вход
              </Link>
              <Link to="/register" onClick={close} className="primary-button ghost">
                Регистрация
              </Link>
            </div>
          )}
        </nav>
        <div className={styles.actions}>
          <button className={styles.mobileMenuButton} onClick={() => setOpen((value) => !value)} type="button">
            {open ? <FaTimes /> : <FaBars />}
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
