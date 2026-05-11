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
import { dismissNotification, pollPlatformNotifications } from "../utils/platformNotifications.js";
import { playNotificationSound, unlockNotificationAudio } from "../utils/notificationSound.js";

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

  useEffect(() => {
    const once = () => {
      unlockNotificationAudio();
      document.removeEventListener("pointerdown", once);
    };
    document.addEventListener("pointerdown", once, { passive: true });
    return () => document.removeEventListener("pointerdown", once);
  }, []);

  const toggleTheme = () => {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  };

  const themeSwitch = (
    <button
      type="button"
      className={styles.themeSwitch}
      onClick={toggleTheme}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
    >
      <span className={styles.themeSwitchInner}>
        <span className={styles.themeSwitchIcon} aria-hidden>
          <FaSun />
        </span>
        <span
          className={`${styles.themeSwitchTrack} ${isDark ? styles.themeSwitchTrackOn : ""}`}
          aria-hidden
        >
          <span
            className={`${styles.themeSwitchThumb} ${isDark ? styles.themeSwitchThumbOn : ""}`}
          />
        </span>
        <span className={styles.themeSwitchIcon} aria-hidden>
          <FaMoon />
        </span>
      </span>
    </button>
  );

  const handleRoleSwitch = async (event) => {
    const role = event.target.value;
    try {
      await switchRole(role);
    } catch (error) {
      console.error(error);
    }
  };

  const dashboardErrorLogged = useRef(false);
  const previousNotifyIdsRef = useRef(null);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      previousNotifyIdsRef.current = null;
      return;
    }

    previousNotifyIdsRef.current = null;
    dashboardErrorLogged.current = false;
    let isUnmounted = false;
    const loadNotifications = async () => {
      try {
        const next = await pollPlatformNotifications(user, token);
        if (isUnmounted) return;
        dashboardErrorLogged.current = false;

        const prevIds = previousNotifyIdsRef.current;
        if (prevIds !== null) {
          const hasNew = next.some((n) => !prevIds.has(n.id));
          if (hasNew) playNotificationSound();
        }
        previousNotifyIdsRef.current = new Set(next.map((n) => n.id));

        setNotifications(next);
      } catch (error) {
        if (!dashboardErrorLogged.current) {
          console.error(error);
          dashboardErrorLogged.current = true;
        }
        if (!isUnmounted) setNotifications([]);
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
          <div className={styles.navClusterLeft}>
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
            <Link to="/about" onClick={close} className={styles.navLink}>
              О нас
            </Link>
          </div>
          <div className={styles.navClusterRight}>
            <Link to="/chat" onClick={close} className={styles.navLink}>
              <FaComments />
              Чат
            </Link>
            <Link to="/reviews" onClick={close} className={styles.navLink}>
              <FaUser />
              Отзывы
            </Link>
            {user ? (
              <div className={styles.navAuth}>
                <div className={styles.dropdownWrap} ref={notificationsDropdownRef}>
                <button
                  className={styles.notificationButton}
                  type="button"
                  onClick={() => {
                    unlockNotificationAudio();
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
                    {notifications.map((item) => (
                      <button
                        key={item.id}
                        className={styles.notificationItem}
                        onClick={() => {
                          if (item.dismissOnly) {
                            dismissNotification(user.id, item.id);
                            setNotifications((prev) => prev.filter((n) => n.id !== item.id));
                            return;
                          }
                          if (item.route) navigate(item.route);
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
                    <Link to="/profile" onClick={close} className={styles.dropdownLink}>
                      Профиль
                    </Link>
                    <label className={styles.dropdownField}>
                      <span>Роль</span>
                      <select value={user.role} onChange={handleRoleSwitch} className={styles.roleSelect}>
                        <option value="worker">Исполнитель</option>
                        <option value="employer">Работодатель</option>
                      </select>
                    </label>
                    <button className={styles.dropdownButton} onClick={logout} type="button">
                      Выйти
                    </button>
                  </div>
                )}
                </div>
                {themeSwitch}
              </div>
            ) : (
              <div className={styles.navAuth}>
                <Link to="/login" onClick={close} className={styles.navLink}>
                  Вход
                </Link>
                <Link to="/register" onClick={close} className="primary-button ghost">
                  Регистрация
                </Link>
                {themeSwitch}
              </div>
            )}
          </div>
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
